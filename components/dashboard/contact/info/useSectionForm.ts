'use client';

import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import toast from 'react-hot-toast';
import type { ZodType } from 'zod';
import { toFieldErrors, type FieldErrors } from '@/lib/contact/validation';
import type { ContactActionResult } from '@/lib/data/contact-info-actions';

type Options<T extends FieldValues> = {
    schema: ZodType<T>;
    defaultValues: DefaultValues<T>;
    action: (values: T) => Promise<ContactActionResult>;
};

/**
 * Shared behaviour of every Contact-info section form:
 *   - validates with the same Zod schema the server action uses (inline errors),
 *   - calls the server action, mapping server-side field errors back onto inputs,
 *   - toasts the outcome and re-baselines the form so "unsaved changes" clears.
 */
export function useSectionForm<T extends FieldValues>({ schema, defaultValues, action }: Options<T>) {
    const form = useForm<T>({ defaultValues });

    const showFieldErrors = (errors: FieldErrors) => {
        for (const [path, message] of Object.entries(errors)) {
            form.setError(path as Path<T>, { type: 'server', message });
        }
    };

    const submit = form.handleSubmit(async (values) => {
        const parsed = schema.safeParse(values);
        if (!parsed.success) {
            showFieldErrors(toFieldErrors(parsed.error));
            toast.error('Please fix the highlighted fields.');
            return;
        }

        try {
            const result = await action(parsed.data);
            if (result.success) {
                toast.success(result.message);
                form.reset(parsed.data as DefaultValues<T>);
                return;
            }
            if (result.error.fieldErrors) showFieldErrors(result.error.fieldErrors);
            toast.error(result.error.message);
        } catch (error) {
            console.error(error);
            toast.error('Could not reach the server. Check your connection and try again.');
        }
    });

    return { form: form as UseFormReturn<T>, submit, isSaving: form.formState.isSubmitting, isDirty: form.formState.isDirty };
}
