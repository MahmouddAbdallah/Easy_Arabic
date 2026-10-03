'use client';

import { Controller } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DAY_NAMES } from '@/lib/contact/helpers';
import { contactHoursSchema, type ContactHoursValues } from '@/lib/contact/validation';
import { updateContactHours } from '@/lib/data/contact-info-actions';
import { Field, FieldGroup, SectionForm, VisibilityToggle } from './FormParts';
import { useSectionForm } from './useSectionForm';

export default function HoursSection({ defaultValues }: { defaultValues: ContactHoursValues }) {
    const { form, submit, isSaving, isDirty } = useSectionForm({ schema: contactHoursSchema, defaultValues, action: updateContactHours });
    const { register, control, watch, formState: { errors }, reset } = form;

    return (
        <SectionForm
            title="Business hours"
            description="When your team is available. Visitors see these in your time zone, with today highlighted."
            isDirty={isDirty}
            isSaving={isSaving}
            onSubmit={submit}
            onReset={() => reset(defaultValues)}
        >
            <VisibilityToggle control={control} name="showHoursSection" hides="the business hours card" disabled={isSaving} />

            <FieldGroup title="Settings">
                <Field label="Time zone" htmlFor="timezone" error={errors.timezone?.message} hint="IANA name, e.g. Africa/Cairo or America/New_York.">
                    <Input id="timezone" list="timezone-options" autoComplete="off" disabled={isSaving} {...register('timezone')} />
                    <datalist id="timezone-options">
                        {(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []).map((tz) => (
                            <option key={tz} value={tz} />
                        ))}
                    </datalist>
                </Field>
                <Field label="Note under the hours" htmlFor="businessHoursNote" error={errors.businessHoursNote?.message}>
                    <Textarea id="businessHoursNote" rows={2} disabled={isSaving} {...register('businessHoursNote')} />
                </Field>
            </FieldGroup>

            <fieldset className="space-y-3">
                <legend className="text-sm font-bold text-foreground">Weekly schedule</legend>
                <div className="divide-y divide-border/50 rounded-xl border border-border/60">
                    {DAY_NAMES.map((dayName, index) => {
                        const isOpen = watch(`hours.${index}.isOpen`);
                        const dayErrors = errors.hours?.[index];
                        return (
                            <div key={dayName} className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[9rem_1fr] sm:items-start sm:p-4">
                                <div className="flex items-center gap-3 sm:pt-2">
                                    <Controller
                                        control={control}
                                        name={`hours.${index}.isOpen`}
                                        render={({ field }) => (
                                            <Checkbox
                                                id={`open-${index}`}
                                                checked={field.value}
                                                onCheckedChange={(checked) => field.onChange(checked === true)}
                                                disabled={isSaving}
                                            />
                                        )}
                                    />
                                    <label htmlFor={`open-${index}`} className="text-sm font-semibold">
                                        {dayName}
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">{isOpen ? 'Open' : 'Closed'}</span>
                                    </label>
                                </div>

                                {isOpen ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Opens" htmlFor={`opens-${index}`} error={dayErrors?.opensAt?.message}>
                                            <Input id={`opens-${index}`} type="time" disabled={isSaving} {...register(`hours.${index}.opensAt`)} />
                                        </Field>
                                        <Field label="Closes" htmlFor={`closes-${index}`} error={dayErrors?.closesAt?.message}>
                                            <Input id={`closes-${index}`} type="time" disabled={isSaving} {...register(`hours.${index}.closesAt`)} />
                                        </Field>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground sm:pt-2.5">Shown as “Closed” on the Contact page.</p>
                                )}
                            </div>
                        );
                    })}
                </div>
                {typeof errors.hours?.message === 'string' && <p role="alert" className="text-[11px] font-medium text-destructive">{errors.hours.message}</p>}
            </fieldset>
        </SectionForm>
    );
}
