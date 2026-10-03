'use client';

import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { mapEmbedUrl } from '@/lib/contact/helpers';
import { contactLocationSchema, type ContactLocationValues } from '@/lib/contact/validation';
import { updateContactLocation } from '@/lib/data/contact-info-actions';
import { Field, FieldGroup, SectionForm } from './FormParts';
import { useSectionForm } from './useSectionForm';

export default function LocationSection({ defaultValues }: { defaultValues: ContactLocationValues }) {
    const { form, submit, isSaving, isDirty } = useSectionForm({ schema: contactLocationSchema, defaultValues, action: updateContactLocation });
    const { register, watch, formState: { errors }, reset } = form;

    const lat = watch('latitude');
    const lng = watch('longitude');
    const hasValidPin = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    return (
        <SectionForm
            title="Office location"
            description="The address and map pin shown in the location section."
            isDirty={isDirty}
            isSaving={isSaving}
            onSubmit={submit}
            onReset={() => reset(defaultValues)}
        >
            <FieldGroup title="Address">
                <Field label="Office name" htmlFor="officeName" error={errors.officeName?.message} className="sm:col-span-2">
                    <Input id="officeName" disabled={isSaving} {...register('officeName')} />
                </Field>
                <Field label="Address line 1" htmlFor="addressLine1" error={errors.addressLine1?.message}>
                    <Input id="addressLine1" autoComplete="off" disabled={isSaving} {...register('addressLine1')} />
                </Field>
                <Field label="Address line 2" htmlFor="addressLine2" optional error={errors.addressLine2?.message}>
                    <Input id="addressLine2" autoComplete="off" disabled={isSaving} {...register('addressLine2')} />
                </Field>
                <Field label="City" htmlFor="city" error={errors.city?.message}>
                    <Input id="city" disabled={isSaving} {...register('city')} />
                </Field>
                <Field label="State / region" htmlFor="stateRegion" optional error={errors.stateRegion?.message}>
                    <Input id="stateRegion" disabled={isSaving} {...register('stateRegion')} />
                </Field>
                <Field label="Postal code" htmlFor="postalCode" optional error={errors.postalCode?.message}>
                    <Input id="postalCode" disabled={isSaving} {...register('postalCode')} />
                </Field>
                <Field label="Country" htmlFor="country" error={errors.country?.message}>
                    <Input id="country" disabled={isSaving} {...register('country')} />
                </Field>
            </FieldGroup>

            <FieldGroup title="Map pin" description="Copy the coordinates from Google Maps (right-click a place) or OpenStreetMap.">
                <Field label="Latitude" htmlFor="latitude" error={errors.latitude?.message} hint="Between -90 and 90">
                    <Input id="latitude" type="number" step="any" inputMode="decimal" disabled={isSaving} className="font-mono" {...register('latitude', { valueAsNumber: true })} />
                </Field>
                <Field label="Longitude" htmlFor="longitude" error={errors.longitude?.message} hint="Between -180 and 180">
                    <Input id="longitude" type="number" step="any" inputMode="decimal" disabled={isSaving} className="font-mono" {...register('longitude', { valueAsNumber: true })} />
                </Field>

                <div className="sm:col-span-2 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                    {hasValidPin ? (
                        <iframe title="Map preview" src={mapEmbedUrl(lat, lng)} loading="lazy" referrerPolicy="no-referrer" className="h-56 w-full" />
                    ) : (
                        <div className="flex h-56 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-5 w-5" />
                            Enter valid coordinates to preview the map
                        </div>
                    )}
                </div>
            </FieldGroup>
        </SectionForm>
    );
}
