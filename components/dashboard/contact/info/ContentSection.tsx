'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contactContentSchema, type ContactContentValues } from '@/lib/contact/validation';
import { updateContactContent } from '@/lib/data/contact-info-actions';
import { Field, FieldGroup, SectionForm } from './FormParts';
import { useSectionForm } from './useSectionForm';

export default function ContentSection({ defaultValues }: { defaultValues: ContactContentValues }) {
    const { form, submit, isSaving, isDirty } = useSectionForm({ schema: contactContentSchema, defaultValues, action: updateContactContent });
    const { register, formState: { errors }, reset } = form;

    return (
        <SectionForm
            title="Page content"
            description="The headline, highlights and wording visitors read on the Contact page."
            isDirty={isDirty}
            isSaving={isSaving}
            onSubmit={submit}
            onReset={() => reset(defaultValues)}
        >
            <FieldGroup title="Hero" description="The first thing visitors see.">
                <Field label="Status badge" htmlFor="heroBadgeText" error={errors.heroBadgeText?.message} hint="Small pill above the headline." className="sm:col-span-2">
                    <Input id="heroBadgeText" disabled={isSaving} {...register('heroBadgeText')} />
                </Field>
                <Field label="Headline" htmlFor="heroHeadline" error={errors.heroHeadline?.message} className="sm:col-span-2">
                    <Input id="heroHeadline" disabled={isSaving} {...register('heroHeadline')} />
                </Field>
                <Field label="Description" htmlFor="heroDescription" error={errors.heroDescription?.message} className="sm:col-span-2">
                    <Textarea id="heroDescription" rows={3} disabled={isSaving} {...register('heroDescription')} />
                </Field>
            </FieldGroup>

            <FieldGroup title="Highlights strip" description="Three short promises shown under the hero.">
                <Field label="Response time" htmlFor="responseTime" error={errors.responseTime?.message} hint='e.g. "Within one business day"'>
                    <Input id="responseTime" disabled={isSaving} {...register('responseTime')} />
                </Field>
                <Field label="Support languages" htmlFor="supportLanguages" error={errors.supportLanguages?.message} hint='e.g. "Arabic & English"'>
                    <Input id="supportLanguages" disabled={isSaving} {...register('supportLanguages')} />
                </Field>
                <Field label="Trial lesson text" htmlFor="trialLessonText" error={errors.trialLessonText?.message} className="sm:col-span-2">
                    <Input id="trialLessonText" disabled={isSaving} {...register('trialLessonText')} />
                </Field>
            </FieldGroup>

            <FieldGroup title="Contact form" description="Wording around the message form.">
                <Field label="Form title" htmlFor="formTitle" error={errors.formTitle?.message}>
                    <Input id="formTitle" disabled={isSaving} {...register('formTitle')} />
                </Field>
                <Field label="Form description" htmlFor="formDescription" error={errors.formDescription?.message}>
                    <Input id="formDescription" disabled={isSaving} {...register('formDescription')} />
                </Field>
                <Field label="Success title" htmlFor="formSuccessTitle" error={errors.formSuccessTitle?.message} hint="Shown after a message is sent.">
                    <Input id="formSuccessTitle" disabled={isSaving} {...register('formSuccessTitle')} />
                </Field>
                <Field label="Success message" htmlFor="formSuccessMessage" error={errors.formSuccessMessage?.message}>
                    <Textarea id="formSuccessMessage" rows={2} disabled={isSaving} {...register('formSuccessMessage')} />
                </Field>
            </FieldGroup>

            <FieldGroup title="FAQ section header" description="The questions themselves are edited in the FAQs tab.">
                <Field label="FAQ title" htmlFor="faqTitle" error={errors.faqTitle?.message}>
                    <Input id="faqTitle" disabled={isSaving} {...register('faqTitle')} />
                </Field>
                <Field label="FAQ description" htmlFor="faqDescription" error={errors.faqDescription?.message}>
                    <Input id="faqDescription" disabled={isSaving} {...register('faqDescription')} />
                </Field>
            </FieldGroup>
        </SectionForm>
    );
}
