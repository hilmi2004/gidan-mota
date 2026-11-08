import crypto from 'node:crypto';
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import { PaymentModel, UserModel, WalletTransactionModel } from '../../models/index.js';
import { paymentAdapter } from '../../adapters/paystack.adapter.js';
import {
  creditDepositToWallet,
  getOrCreateWallet,
  getPlatformDepositConfig,
  withdrawAvailableDeposit,
} from './wallet.service.js';

export const walletRouter: IRouter = Router();

walletRouter.get(
  '/wallet',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const [wallet, config, transactions] = await Promise.all([
      getOrCreateWallet(userId),
      getPlatformDepositConfig(),
      WalletTransactionModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    const biddingPowerKobo = wallet.availableKobo * config.depositMultiplier;
    const totalDepositKobo = wallet.availableKobo + wallet.heldKobo;

    res.json({
      wallet: {
        _id: wallet._id,
        userId: wallet.userId,
        availableKobo: wallet.availableKobo,
        heldKobo: wallet.heldKobo,
        forfeitedKobo: wallet.forfeitedKobo,
        totalDepositKobo,
        biddingPowerKobo,
        minDepositKobo: config.minDepositKobo,
        depositMultiplier: config.depositMultiplier,
        currency: wallet.currency,
      },
      transactions,
    });
  }),
);

const InitializeDepositSchema = z.object({
  amountKobo: z.number().int().positive(),
  purpose: z
    .enum(['bidding_deposit', 'promotion', 'dealer_subscription', 'auction_fee'])
    .default('bidding_deposit'),
  idempotencyKey: z.string().min(4).optional(),
  metadata: z.record(z.unknown()).optional(),
});

walletRouter.post(
  '/payments/paystack/initialize',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = InitializeDepositSchema.parse(req.body);
    const userId = req.user!.sub;
    const config = await getPlatformDepositConfig();

    if (
      parsed.purpose === 'bidding_deposit' &&
      parsed.amountKobo < config.minDepositKobo
    ) {
      throw AppError.badRequest(
        'DEPOSIT_BELOW_MINIMUM',
        `Minimum refundable bidding deposit is ₦${(config.minDepositKobo / 100).toLocaleString()}`,
      );
    }

    const user = await UserModel.findById(userId).lean();
    if (!user) {
      throw AppError.notFound('USER_NOT_FOUND', 'User account not found');
    }

    const idempotencyKey =
      parsed.idempotencyKey ??
      `init:${userId}:${parsed.purpose}:${parsed.amountKobo}:${Date.now()}:${crypto
        .randomBytes(4)
        .toString('hex')}`;

    const existingPayment = await PaymentModel.findOne({ idempotencyKey });
    if (existingPayment) {
      res.json({
        payment: existingPayment,
        authorizationUrl: `${process.env.WEB_URL ?? 'http://localhost:5173'}/wallet?reference=${existingPayment.reference}`,
        reference: existingPayment.reference,
        provider: existingPayment.provider,
      });
      return;
    }

    const reference = `ADY_${parsed.purpose.toUpperCase().slice(0, 3)}_${Date.now()}_${crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;

    const initResult = await paymentAdapter.initializeTransaction({
      email: user.email || `${user.phone.replace('+', '')}@autodey.ng`,
      amountKobo: parsed.amountKobo,
      reference,
      metadata: {
        userId,
        purpose: parsed.purpose,
        ...parsed.metadata,
      },
    });

    const payment = await PaymentModel.create({
      userId: user._id,
      reference,
      idempotencyKey,
      purpose: parsed.purpose,
      amountKobo: parsed.amountKobo,
      status: 'pending',
      provider: initResult.provider,
      metadata: parsed.metadata,
    });

    res.status(201).json({
      payment,
      authorizationUrl: initResult.authorizationUrl,
      accessCode: initResult.accessCode,
      reference: initResult.reference,
      provider: initResult.provider,
    });
  }),
);

/**
 * Paystack Webhook endpoint (`POST /api/v1/payments/paystack/webhook`).
 * Verifies HMAC-SHA512 / mock signature and processes `charge.success` idempotently.
 */
walletRouter.post(
  '/payments/paystack/webhook',
  asyncHandler(async (req, res) => {
    const signatureHeader = req.headers['x-paystack-signature'] as string | undefined;
    const rawBody = JSON.stringify(req.body ?? {});

    if (!paymentAdapter.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw AppError.unauthorized('INVALID_WEBHOOK_SIGNATURE', 'Invalid Paystack webhook signature');
    }

    const event = req.body as {
      event?: string;
      data?: {
        reference?: string;
        amount?: number;
        status?: string;
        metadata?: { userId?: string; purpose?: string };
      };
    };

    if (event.event !== 'charge.success' || !event.data?.reference) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const reference = event.data.reference;
    const payment = await PaymentModel.findOne({ reference });

    if (!payment) {
      res.status(200).json({ received: true, warning: 'PAYMENT_NOT_FOUND' });
      return;
    }

    if (payment.status !== 'success') {
      payment.status = 'success';
      payment.paidAt = new Date();
      await payment.save();
    }

    if (payment.purpose === 'bidding_deposit') {
      const creditResult = await creditDepositToWallet({
        userId: payment.userId,
        amountKobo: payment.amountKobo,
        reference: payment.reference,
        idempotencyKey: `paystack-webhook:${payment.reference}`,
        description: `Refundable bidding deposit funded via Paystack (${payment.reference})`,
      });

      res.status(200).json({
        received: true,
        alreadyProcessed: creditResult.alreadyProcessed,
        wallet: creditResult.wallet,
      });
      return;
    }

    res.status(200).json({ received: true, payment });
  }),
);

const WithdrawSchema = z.object({
  amountKobo: z.number().int().positive(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  idempotencyKey: z.string().min(4).optional(),
});

walletRouter.post(
  '/wallet/withdraw',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = WithdrawSchema.parse(req.body);
    const idempotencyKey =
      parsed.idempotencyKey ??
      `withdraw:${req.user!.sub}:${parsed.amountKobo}:${Date.now()}:${crypto
        .randomBytes(3)
        .toString('hex')}`;

    const result = await withdrawAvailableDeposit({
      userId: req.user!.sub,
      amountKobo: parsed.amountKobo,
      bankName: parsed.bankName,
      accountNumber: parsed.accountNumber,
      idempotencyKey,
    });

    res.json({
      wallet: result.wallet,
      transaction: result.transaction,
      refundReference: result.refundReference,
    });
  }),
);

