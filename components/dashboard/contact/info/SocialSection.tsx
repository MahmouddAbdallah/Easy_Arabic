'use client';

import { Input } from '@/components/ui/input';
import { contactSocialSchema, type ContactSocialValues } from '@/lib/contact/validation';
import { updateContactSocial } from '@/lib/data/contact-info-actions';
import { Field, FieldGroup, SectionForm } from './FormParts';
import { useSectionForm } from './useSectionForm';

export default function SocialSection({ defaultValues }: { defaultValues: ContactSocialValues }) {
    const { form, submit, isSaving, isDirty } = useSectionForm({ schema: contactSocialSchema, defaultValues, action: updateContactSocial });
    const { register, formState: { errors }, reset } = form;

    return (
        <SectionForm
            title="Social links"
            description="Profiles shown next to the FAQs. Leave a field empty to hide that platform."
            isDirty={isDirty}
            isSaving={isSaving}
            onSubmit={submit}
            onReset={() => reset(defaultValues)}
        >
            <FieldGroup title="Profiles">
                <Field label="Facebook" htmlFor="facebookUrl" optional error={errors.facebookUrl?.message} hint="https://www.facebook.com/yourpage">
                    <Input id="facebookUrl" type="url" inputMode="url" disabled={isSaving} {...register('facebookUrl')} />
                </Field>
                <Field label="Instagram" htmlFor="instagramUrl" optional error={errors.instagramUrl?.message} hint="https://www.instagram.com/yourhandle">
                    <Input id="instagramUrl" type="url" inputMode="url" disabled={isSaving} {...register('instagramUrl')} />
                </Field>
                <Field label="LinkedIn" htmlFor="linkedinUrl" optional error={errors.linkedinUrl?.message} hint="https://www.linkedin.com/company/yourcompany">
                    <Input id="linkedinUrl" type="url" inputMode="url" disabled={isSaving} {...register('linkedinUrl')} />
                </Field>
                <Field label="X / Twitter" htmlFor="xUrl" optional error={errors.xUrl?.message} hint="https://x.com/yourhandle">
                    <Input id="xUrl" type="url" inputMode="url" disabled={isSaving} {...register('xUrl')} />
                </Field>
            </FieldGroup>
        </SectionForm>
    );
}
