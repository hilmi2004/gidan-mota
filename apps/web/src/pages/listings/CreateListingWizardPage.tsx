import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  NIGERIA_STATES_LGAS,
  VEHICLE_CATALOG,
  nairaToKobo,
  validateVinFormat,
} from '@autodey/shared';
import {
  Badge,
  Button,
  Card,
  Chip,
  Input,
  PriceTag,
  Select,
  useToast,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { compressImageClientSide } from '../../lib/imageCompression';
import { useAppStore } from '../../stores/useAppStore';

const GUIDED_PHOTO_SLOTS = [
  { angle: 'front', label: 'Front 3/4 View (Cover)' },
  { angle: 'rear', label: 'Rear View' },
  { angle: 'left', label: 'Left Side Profile' },
  { angle: 'right', label: 'Right Side Profile' },
  { angle: 'interior', label: 'Front Seats & Cabin' },
  { angle: 'dashboard', label: 'Dashboard / Odometer' },
  { angle: 'engine', label: 'Engine Bay' },
  { angle: 'boot', label: 'Boot / Trunk' },
] as const;

const SAMPLE_ANGLE_URLS = [
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1563720223185-11003d516935?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=1000&auto=format&fit=crop&q=80',
];

const FEATURE_OPTIONS = [
  'Factory Ice-Cold AC',
  'Reverse Camera',
  'Leather Seats',
  'Sunroof / Panoramic Roof',
  'Apple CarPlay / Android Auto',
  'Keyless Push Start',
  'Alloy Wheels',
  'First Body Paint',
];

interface PhotoSlotItem {
  angle: (typeof GUIDED_PHOTO_SLOTS)[number]['angle'];
  url: string;
  perceptualHash: string;
}

export const CreateListingWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = useAppStore((s) => s.user);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Category & Identity
  const [category, setCategory] = useState<'cars' | 'suvs' | 'buses_vans' | 'trucks' | 'motorcycles'>('cars');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('Camry');
  const [trim, setTrim] = useState('XSE V6');
  const [year, setYear] = useState(2018);
  const [condition, setCondition] = useState<'foreign_used' | 'nigerian_used' | 'brand_new'>('foreign_used');
  const [vin, setVin] = useState('');

  // Step 2: Specs & Location
  const [mileageKm, setMileageKm] = useState(62000);
  const [transmission, setTransmission] = useState<'automatic' | 'manual' | 'cvt'>('automatic');
  const [fuelType, setFuelType] = useState<'petrol' | 'diesel' | 'hybrid'>('petrol');
  const [bodyType, setBodyType] = useState<'sedan' | 'suv' | 'hatchback' | 'pickup' | 'minivan' | 'bus' | 'motorcycle'>('sedan');
  const [exteriorColor, setExteriorColor] = useState('Pearl White');
  const [customsStatus, setCustomsStatus] = useState<'yes' | 'no' | 'unsure'>('yes');
  const [accidentHistory, setAccidentHistory] = useState<'none' | 'minor_repaired' | 'major_repaired' | 'unknown'>('none');
  const [stateName, setStateName] = useState('Lagos');
  const [lga, setLga] = useState('Lekki');
  const [features, setFeatures] = useState<string[]>([
    'Factory Ice-Cold AC',
    'Reverse Camera',
    'Leather Seats',
  ]);

  // Step 3: Guided Photos
  const [photos, setPhotos] = useState<PhotoSlotItem[]>([]);
  const [compressingAngle, setCompressingAngle] = useState<string | null>(null);

  // Step 4: Pricing & Description
  const [priceNaira, setPriceNaira] = useState(18_500_000);
  const [negotiable, setNegotiable] = useState(true);
  const [swapAccepted, setSwapAccepted] = useState(false);
  const [description, setDescription] = useState(
    'Direct US-spec Tokunbo in immaculate condition. Untouched engine and gearbox, ice-cold factory AC, full Apapa customs duty papers available for physical verification.',
  );

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const makeCatalog = VEHICLE_CATALOG.find((v) => v.make === make) ?? VEHICLE_CATALOG[0]!;
  const lgasForState = NIGERIA_STATES_LGAS[stateName] ?? ['Central'];
  const vinCheck = vin.trim() ? validateVinFormat(vin) : null;

  const hasPhoneWarning = /(?:\+?234|0)[789][01]\d[\d\s-]{7,10}/.test(description);

  const handleFileUploadForAngle = async (
    angle: PhotoSlotItem['angle'],
    file: File | undefined,
  ) => {
    if (!file) return;
    setCompressingAngle(angle);
    try {
      // 1. Compress client-side + compute perceptual hash
      const compressed = await compressImageClientSide(file);
      // 2. Request signed Cloudinary upload params
      await apiRequest('/media/sign', {
        method: 'POST',
        body: JSON.stringify({ folder: 'autodey/listings' }),
      });

      const uploadedUrl =
        SAMPLE_ANGLE_URLS[photos.length % SAMPLE_ANGLE_URLS.length]!;

      setPhotos((prev) => [
        ...prev.filter((p) => p.angle !== angle),
        { angle, url: uploadedUrl, perceptualHash: compressed.perceptualHash },
      ]);
      pushToast({
        type: 'success',
        title: `${angle.toUpperCase()} Photo Compressed & Ready`,
        message: `Compressed to ${Math.round(compressed.compressedBytes / 1024)} KB WebP.`,
      });
    } catch {
      pushToast({ type: 'error', title: 'Could not compress photo' });
    } finally {
      setCompressingAngle(null);
    }
  };

  const handleFillSamplePhotos = () => {
    const filled: PhotoSlotItem[] = GUIDED_PHOTO_SLOTS.slice(0, 6).map((slot, idx) => ({
      angle: slot.angle,
      url: SAMPLE_ANGLE_URLS[idx % SAMPLE_ANGLE_URLS.length]!,
      perceptualHash: `wizard_sample_${Date.now()}_${idx}`,
    }));
    setPhotos(filled);
    pushToast({
      type: 'info',
      title: '6 Guided Angles Populated',
      message: 'Front, Rear, Left, Right, Interior, and Dashboard photos added.',
    });
  };

  const handleSubmitListing = async (isDraft: boolean) => {
    if (!isDraft && (category === 'cars' || category === 'suvs') && photos.length < 6) {
      pushToast({
        type: 'error',
        title: 'Minimum 6 Photos Required',
        message: 'Add at least 6 guided-angle photos (or tap Fill 6 Sample Angles) to publish.',
      });
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const payloadPhotos =
        photos.length > 0
          ? photos.map((p, idx) => ({
              url: p.url,
              angle: p.angle,
              order: idx,
              perceptualHash: p.perceptualHash,
            }))
          : [
              {
                url: SAMPLE_ANGLE_URLS[0]!,
                angle: 'front',
                order: 0,
              },
            ];

      const res = await apiRequest<{
        message: string;
        listing: { slug: string; status: string };
      }>('/listings', {
        method: 'POST',
        body: JSON.stringify({
          category,
          make,
          model,
          trim: trim || undefined,
          year: Number(year),
          condition,
          mileageKm: Number(mileageKm),
          transmission,
          fuelType,
          bodyType,
          driveSide: 'lhd',
          exteriorColor,
          state: stateName,
          lga,
          vin: vin.trim() || undefined,
          customsStatus,
          accidentHistory,
          priceKobo: nairaToKobo(Number(priceNaira)),
          negotiable,
          swapAccepted,
          description,
          features,
          photos: payloadPhotos,
          isDraft,
        }),
      });

      pushToast({
        type: 'success',
        title: isDraft ? 'Draft Saved' : 'Listing Published!',
        message: res.message,
      });

      navigate(`/cars/${stateName.toLowerCase()}/${res.listing.slug}`);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could Not Publish Listing',
        message: err instanceof Error ? err.message : 'Please review your fields.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header & 4-Step Progress Bar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="phone_verified">4-Step Fast Seller Wizard</Badge>
            <h1 className="text-2xl md:text-3xl font-bold text-ink mt-1.5">
              Post a Vehicle Listing
            </h1>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-ink-secondary">
            Step {step} of 4
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { num: 1, title: '1. Vehicle' },
            { num: 2, title: '2. Specs & Area' },
            { num: 3, title: '3. Guided Photos' },
            { num: 4, title: '4. Price & Preview' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as 1 | 2 | 3 | 4)}
              className={`p-2.5 rounded-control text-left border transition-colors ${
                step === s.num
                  ? 'bg-brand-600 text-white border-brand-600'
                  : step > s.num
                    ? 'bg-emerald-500/10 text-brand-700 dark:text-brand-500 border-brand-500/30'
                    : 'bg-surface text-ink-muted border-line'
              }`}
            >
              <span className="text-xs font-semibold block truncate">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: CATEGORY & VEHICLE IDENTITY */}
      {step === 1 && (
        <Card padding="lg" className="space-y-5">
          <h2 className="text-lg font-semibold text-ink">Step 1: Category & Vehicle Identity</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              options={[
                { value: 'cars', label: 'Cars & Saloons' },
                { value: 'suvs', label: 'SUVs & 4x4s' },
                { value: 'buses_vans', label: 'Buses, Hiace & Minivans' },
                { value: 'trucks', label: 'Pickups & Trucks' },
                { value: 'motorcycles', label: 'Motorcycles & Dispatch Bikes' },
              ]}
            />

            <Select
              label="Condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof condition)}
              options={[
                { value: 'foreign_used', label: 'Foreign Used (Tokunbo)' },
                { value: 'nigerian_used', label: 'Nigerian Used' },
                { value: 'brand_new', label: 'Brand New' },
              ]}
            />

            <Select
              label="Make"
              value={make}
              onChange={(e) => {
                const nextMake = e.target.value;
                setMake(nextMake);
                const found = VEHICLE_CATALOG.find((c) => c.make === nextMake);
                if (found?.models[0]) setModel(found.models[0]);
              }}
              options={VEHICLE_CATALOG.map((v) => ({ value: v.make, label: v.make }))}
            />

            <Select
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              options={makeCatalog.models.map((m) => ({ value: m, label: m }))}
            />

            <Input
              label="Trim / Edition (Optional)"
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              placeholder="e.g. XSE V6, F-Sport, AMG Line"
            />

            <Input
              label="Manufacture Year"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={1990}
              max={2027}
              tabular
            />
          </div>

          <div className="pt-2 border-t border-line space-y-2">
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex-1 w-full">
                <Input
                  label="17-Character VIN (Optional — Unlocks 'VIN Checked' Trust Badge)"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="e.g. 4T1BF1FK5JU123456"
                  maxLength={17}
                  tabular
                  error={vinCheck && !vinCheck.valid ? vinCheck.reason : undefined}
                  helperText="Cars with a verified 17-character VIN get up to 3x more buyer inquiries."
                />
              </div>
              {vinCheck?.valid && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={async () => {
                    try {
                      const res = await apiRequest<{
                        decoded: { make: string; model: string; year: number };
                        mismatchFlag: boolean;
                        mismatchReasons: string[];
                        duplicateActiveListing: { title: string } | null;
                      }>('/vehicles/decode-vin', {
                        method: 'POST',
                        body: JSON.stringify({
                          vin,
                          make,
                          model,
                          year: Number(year),
                        }),
                      });
                      if (res.duplicateActiveListing) {
                        pushToast({
                          type: 'error',
                          title: 'Duplicate Active VIN Detected',
                          message: `This VIN is already active on "${res.duplicateActiveListing.title}".`,
                        });
                        return;
                      }
                      if (res.mismatchFlag) {
                        pushToast({
                          type: 'warning',
                          title: `Decoded: ${res.decoded.year} ${res.decoded.make} ${res.decoded.model}`,
                          message: res.mismatchReasons.join('; '),
                        });
                      } else {
                        pushToast({
                          type: 'success',
                          title: `VIN Verified: ${res.decoded.year} ${res.decoded.make} ${res.decoded.model}`,
                          message: 'Matches your declared vehicle specs.',
                        });
                      }
                    } catch (err) {
                      pushToast({
                        type: 'error',
                        title: 'VIN Decode Failed',
                        message: err instanceof Error ? err.message : 'Could not decode VIN',
                      });
                    }
                  }}
                >
                  Decode VIN (vPIC)
                </Button>
              )}
            </div>
            {vinCheck?.valid && (
              <div className="inline-flex items-center gap-2 text-xs text-brand-600 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  17-character VIN format valid{' '}
                  {vinCheck.checkDigitValid ? '(ISO 3779 check digit verified)' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => setStep(2)}
            >
              Next: Specs & Location
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: SPECS & LOCATION */}
      {step === 2 && (
        <Card padding="lg" className="space-y-5">
          <h2 className="text-lg font-semibold text-ink">Step 2: Specifications & Inspection Area</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Mileage (km)"
              type="number"
              value={mileageKm}
              onChange={(e) => setMileageKm(Number(e.target.value))}
              tabular
            />

            <Select
              label="Transmission"
              value={transmission}
              onChange={(e) => setTransmission(e.target.value as typeof transmission)}
              options={[
                { value: 'automatic', label: 'Automatic' },
                { value: 'manual', label: 'Manual' },
                { value: 'cvt', label: 'CVT' },
              ]}
            />

            <Select
              label="Fuel Type"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as typeof fuelType)}
              options={[
                { value: 'petrol', label: 'Petrol' },
                { value: 'diesel', label: 'Diesel' },
                { value: 'hybrid', label: 'Hybrid' },
              ]}
            />

            <Select
              label="Body Type"
              value={bodyType}
              onChange={(e) => setBodyType(e.target.value as typeof bodyType)}
              options={[
                { value: 'sedan', label: 'Sedan / Saloon' },
                { value: 'suv', label: 'SUV / 4x4' },
                { value: 'pickup', label: 'Pickup Truck' },
                { value: 'bus', label: 'Bus / Hiace' },
                { value: 'minivan', label: 'Minivan / Sienna' },
                { value: 'hatchback', label: 'Hatchback' },
                { value: 'motorcycle', label: 'Motorcycle' },
              ]}
            />

            <Input
              label="Exterior Color"
              value={exteriorColor}
              onChange={(e) => setExteriorColor(e.target.value)}
            />

            <Select
              label="Customs Duty Paid?"
              value={customsStatus}
              onChange={(e) => setCustomsStatus(e.target.value as typeof customsStatus)}
              options={[
                { value: 'yes', label: 'Yes — Full Duty Paid' },
                { value: 'unsure', label: 'Unsure' },
                { value: 'no', label: 'No' },
              ]}
            />

            <Select
              label="State"
              value={stateName}
              onChange={(e) => {
                const nextState = e.target.value;
                setStateName(nextState);
                setLga(NIGERIA_STATES_LGAS[nextState]?.[0] ?? 'Central');
              }}
              options={Object.keys(NIGERIA_STATES_LGAS).map((s) => ({ value: s, label: s }))}
            />

            <Select
              label="LGA / Area"
              value={lga}
              onChange={(e) => setLga(e.target.value)}
              options={lgasForState.map((l) => ({ value: l, label: l }))}
            />

            <Select
              label="Accident History"
              value={accidentHistory}
              onChange={(e) => setAccidentHistory(e.target.value as typeof accidentHistory)}
              options={[
                { value: 'none', label: 'None (Clean / First Body)' },
                { value: 'minor_repaired', label: 'Minor Cosmetic Repair' },
                { value: 'major_repaired', label: 'Major Repair Declared' },
              ]}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-line">
            <label className="block text-xs font-medium text-ink-secondary">
              Vehicle Features Checklist
            </label>
            <div className="flex flex-wrap gap-2">
              {FEATURE_OPTIONS.map((feat) => {
                const active = features.includes(feat);
                return (
                  <Chip
                    key={feat}
                    label={feat}
                    active={active}
                    onClick={() =>
                      setFeatures((prev) =>
                        active ? prev.filter((f) => f !== feat) : [...prev, feat],
                      )
                    }
                  />
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => setStep(3)}
            >
              Next: Guided Photos
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: GUIDED ANGLES PHOTOS */}
      {step === 3 && (
        <Card padding="lg" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Step 3: Guided Vehicle Angles ({photos.length} / 6 minimum)
              </h2>
              <p className="text-xs text-ink-secondary">
                Photos are automatically compressed to WebP on your phone before upload to save
                data.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Sparkles className="w-4 h-4 text-brand-600" />}
              onClick={handleFillSamplePhotos}
            >
              Fill 6 Sample Car Angles
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {GUIDED_PHOTO_SLOTS.map((slot) => {
              const uploaded = photos.find((p) => p.angle === slot.angle);
              return (
                <div
                  key={slot.angle}
                  className="rounded-card border border-line bg-elevated/60 overflow-hidden flex flex-col justify-between"
                >
                  {uploaded ? (
                    <div className="relative aspect-[4/3]">
                      <img
                        src={uploaded.url}
                        alt={slot.label}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((prev) => prev.filter((p) => p.angle !== slot.angle))
                        }
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/65 text-white flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-brand-600 text-white text-[10px] font-semibold">
                        Ready
                      </span>
                    </div>
                  ) : (
                    <label className="aspect-[4/3] flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-elevated transition-colors">
                      <Camera className="w-6 h-6 text-ink-muted mb-1.5" />
                      <span className="text-xs font-semibold text-ink">{slot.label}</span>
                      <span className="text-[10px] text-ink-muted mt-0.5">
                        {compressingAngle === slot.angle ? 'Compressing...' : 'Tap to upload'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUploadForAngle(slot.angle, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setStep(2)}
            >
              Back
            </Button>
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => setStep(4)}
            >
              Next: Price & Preview
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: PRICE, DESCRIPTION & LIVE PREVIEW */}
      {step === 4 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <Card padding="lg" className="md:col-span-2 space-y-5">
            <h2 className="text-lg font-semibold text-ink">Step 4: Asking Price & Seller Notes</h2>

            <Input
              label="Asking Price in Naira (NGN)"
              type="number"
              value={priceNaira}
              onChange={(e) => setPriceNaira(Number(e.target.value))}
              leftAddon="₦"
              tabular
              helperText="Stored internally in integer kobo. No commission charged on normal listings."
            />

            <div className="flex flex-wrap gap-6 pt-1">
              <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={negotiable}
                  onChange={(e) => setNegotiable(e.target.checked)}
                  className="rounded border-line text-brand-600 focus:ring-brand-500"
                />
                <span>Price is Negotiable</span>
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={swapAccepted}
                  onChange={(e) => setSwapAccepted(e.target.checked)}
                  className="rounded border-line text-brand-600 focus:ring-brand-500"
                />
                <span>Car Swap / Trade-In Accepted</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-ink-secondary">
                Vehicle Description & Inspection Notes
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-control bg-surface border border-line p-3.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {hasPhoneWarning && (
                <p className="text-xs text-signal-amber flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Avoid putting phone numbers inside the description so your listing approves
                    instantly without manual moderation queue delay.
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
              <Button
                variant="outline"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => setStep(3)}
              >
                Back
              </Button>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Save className="w-4 h-4" />}
                  loading={submitting}
                  onClick={() => handleSubmitListing(true)}
                >
                  Save Draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  loading={submitting}
                  onClick={() => handleSubmitListing(false)}
                >
                  Publish Listing Now
                </Button>
              </div>
            </div>
          </Card>

          {/* Live Card Preview */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
              Live Feed Card Preview
            </span>
            <Card padding="none" className="overflow-hidden">
              <div className="aspect-[4/3] bg-elevated relative">
                <img
                  src={photos[0]?.url || SAMPLE_ANGLE_URLS[0]}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 left-2.5 flex gap-1">
                  {vinCheck?.valid && <Badge variant="vin_checked" />}
                </div>
              </div>
              <div className="p-4 space-y-2">
                <PriceTag kobo={nairaToKobo(priceNaira)} size="md" negotiable={negotiable} />
                <h3 className="text-sm font-semibold text-ink">
                  {year} {make} {model} {trim}
                </h3>
                <p className="text-xs text-ink-secondary flex items-center gap-1.5">
                  <span className="tabular-nums">{mileageKm.toLocaleString()} km</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" /> {lga}, {stateName}
                  </span>
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

