'use client';

import { ArrowDown, ArrowUp, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contactFaqsSchema, MAX_FAQS, type ContactFaqsValues } from '@/lib/contact/validation';
import { updateContactFaqs } from '@/lib/data/contact-info-actions';
import { Field, SectionForm, VisibilityToggle } from './FormParts';
import { useSectionForm } from './useSectionForm';

export default function FaqsSection({ defaultValues }: { defaultValues: ContactFaqsValues }) {
    const { form, submit, isSaving, isDirty } = useSectionForm({ schema: contactFaqsSchema, defaultValues, action: updateContactFaqs });
    const { register, control, formState: { errors }, reset } = form;

    // keyName: the rows' own `id` (database id) must not be overwritten by RHF's internal key.
    const { fields, append, remove, move } = useFieldArray({ control, name: 'faqs', keyName: 'fieldKey' });

    return (
        <SectionForm
            title="Frequently asked questions"
            description="Shown as an accordion on the Contact page, in the order below. Unpublished questions stay hidden."
            isDirty={isDirty}
            isSaving={isSaving}
            onSubmit={submit}
            onReset={() => reset(defaultValues)}
        >
            <VisibilityToggle control={control} name="showFaqsSection" hides="the FAQ accordion" disabled={isSaving} />

            {fields.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 py-10 text-center">
                    <HelpCircle className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-semibold">No questions yet</p>
                    <p className="max-w-xs text-xs text-muted-foreground">The FAQ section is hidden on the Contact page until you add and publish a question.</p>
                </div>
            ) : (
                <ol className="space-y-4">
                    {fields.map((field, index) => {
                        const rowErrors = errors.faqs?.[index];
                        return (
                            <li key={field.fieldKey} className="rounded-xl border border-border/60 bg-background p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-muted-foreground">Question {index + 1}</span>
                                    <div className="flex items-center gap-1">
                                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0 || isSaving} onClick={() => move(index, index - 1)}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === fields.length - 1 || isSaving} onClick={() => move(index, index + 1)}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete question" className="text-destructive hover:text-destructive" disabled={isSaving} onClick={() => remove(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Field label="Question" htmlFor={`faq-q-${index}`} error={rowErrors?.question?.message}>
                                        <Input id={`faq-q-${index}`} disabled={isSaving} {...register(`faqs.${index}.question`)} />
                                    </Field>
                                    <Field label="Answer" htmlFor={`faq-a-${index}`} error={rowErrors?.answer?.message}>
                                        <Textarea id={`faq-a-${index}`} rows={3} disabled={isSaving} {...register(`faqs.${index}.answer`)} />
                                    </Field>
                                    <div className="flex items-center gap-2">
                                        <Controller
                                            control={control}
                                            name={`faqs.${index}.isPublished`}
                                            render={({ field: f }) => (
                                                <Checkbox id={`faq-p-${index}`} checked={f.value} onCheckedChange={(c) => f.onChange(c === true)} disabled={isSaving} />
                                            )}
                                        />
                                        <label htmlFor={`faq-p-${index}`} className="text-xs font-medium">Published on the Contact page</label>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {typeof errors.faqs?.message === 'string' && <p role="alert" className="text-[11px] font-medium text-destructive">{errors.faqs.message}</p>}

            <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={isSaving || fields.length >= MAX_FAQS}
                onClick={() => append({ question: '', answer: '', isPublished: true })}
            >
                <Plus className="h-4 w-4" />
                Add question
                <span className="text-muted-foreground">({fields.length}/{MAX_FAQS})</span>
            </Button>
        </SectionForm>
    );
}
