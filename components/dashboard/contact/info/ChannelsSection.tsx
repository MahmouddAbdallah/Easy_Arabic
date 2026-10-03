'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contactChannelsSchema, type ContactChannelsValues } from '@/lib/contact/validation';
import { updateContactChannels } from '@/lib/data/contact-info-actions';
import { Field, FieldGroup, SectionForm, VisibilityToggle } from './FormParts';
import { useSectionForm } from './useSectionForm';

export default function ChannelsSection({ defaultValues }: { defaultValues: ContactChannelsValues }) {
    const { form, submit, isSaving, isDirty } = useSectionForm({ schema: contactChannelsSchema, defaultValues, action: updateContactChannels });
    const { register, control, formState: { errors }, reset } = form;

    return (
        <SectionForm
            title="Contact channels"
            description="Phone, email addresses and WhatsApp that visitors can use to reach you."
            isDirty={isDirty}
            isSaving={isSaving}
            onSubmit={submit}
            onReset={() => reset(defaultValues)}
        >
            <VisibilityToggle control={control} name="showChannelsSection" hides="the phone and email cards, the billing email and the WhatsApp chat card" disabled={isSaving} />

            <FieldGroup title="Phone" description="Shown in the hero. Visitors can tap it to call.">
                <Field label="Label" htmlFor="phoneLabel" error={errors.phoneLabel?.message}>
                    <Input id="phoneLabel" disabled={isSaving} {...register('phoneLabel')} />
                </Field>
                <Field label="Phone number" htmlFor="phoneNumber" error={errors.phoneNumber?.message} hint="Include the country code, e.g. +20 100 000 0000.">
                    <Input id="phoneNumber" type="tel" inputMode="tel" disabled={isSaving} className="font-mono" {...register('phoneNumber')} />
                </Field>
                <Field label="Note" htmlFor="phoneNote" error={errors.phoneNote?.message} className="sm:col-span-2">
                    <Input id="phoneNote" disabled={isSaving} {...register('phoneNote')} />
                </Field>
            </FieldGroup>

            <FieldGroup title="Support email" description="Shown in the hero.">
                <Field label="Label" htmlFor="supportEmailLabel" error={errors.supportEmailLabel?.message}>
                    <Input id="supportEmailLabel" disabled={isSaving} {...register('supportEmailLabel')} />
                </Field>
                <Field label="Email address" htmlFor="supportEmail" error={errors.supportEmail?.message}>
                    <Input id="supportEmail" type="email" inputMode="email" disabled={isSaving} {...register('supportEmail')} />
                </Field>
                <Field label="Note" htmlFor="supportEmailNote" error={errors.supportEmailNote?.message} className="sm:col-span-2">
                    <Input id="supportEmailNote" disabled={isSaving} {...register('supportEmailNote')} />
                </Field>
            </FieldGroup>

            <FieldGroup title="Billing email" description="Shown under the map. Leave empty to hide it.">
                <Field label="Email address" htmlFor="billingEmail" optional error={errors.billingEmail?.message} className="sm:col-span-2">
                    <Input id="billingEmail" type="email" inputMode="email" disabled={isSaving} {...register('billingEmail')} />
                </Field>
            </FieldGroup>

            <FieldGroup title="WhatsApp" description="Leave the number empty to hide the WhatsApp card.">
                <Field
                    label="WhatsApp number"
                    htmlFor="whatsappNumber"
                    optional
                    error={errors.whatsappNumber?.message}
                    hint="With country code. Stored as digits only, e.g. 201000000000."
                    className="sm:col-span-2"
                >
                    <Input id="whatsappNumber" type="tel" inputMode="tel" disabled={isSaving} className="font-mono" {...register('whatsappNumber')} />
                </Field>
                <Field label="Card title" htmlFor="whatsappTitle" error={errors.whatsappTitle?.message}>
                    <Input id="whatsappTitle" disabled={isSaving} {...register('whatsappTitle')} />
                </Field>
                <Field label="Button label" htmlFor="whatsappButtonLabel" error={errors.whatsappButtonLabel?.message}>
                    <Input id="whatsappButtonLabel" disabled={isSaving} {...register('whatsappButtonLabel')} />
                </Field>
                <Field label="Card description" htmlFor="whatsappDescription" error={errors.whatsappDescription?.message} className="sm:col-span-2">
                    <Textarea id="whatsappDescription" rows={2} disabled={isSaving} {...register('whatsappDescription')} />
                </Field>
                <Field
                    label="Pre-filled message"
                    htmlFor="whatsappPrefilledMessage"
                    error={errors.whatsappPrefilledMessage?.message}
                    hint="The text already typed in when a visitor opens the chat."
                    className="sm:col-span-2"
                >
                    <Textarea id="whatsappPrefilledMessage" rows={2} disabled={isSaving} {...register('whatsappPrefilledMessage')} />
                </Field>
            </FieldGroup>
        </SectionForm>
    );
}
