'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ErrorMsg from '../ErrorMsg';

type Props = {
  title: string;
  description: string;
  successTitle: string;
  successMessage: string;
};

type FormValues = { name: string; email: string; phone: string; message: string };

const fieldClass = 'rounded-xl border-border/80 bg-background/60 backdrop-blur-md text-sm focus-visible:ring-primary/50';

export default function ContactForm({ title, description, successTitle, successMessage }: Props) {
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { name: '', email: '', phone: '', message: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await axios.post('/api/contact', values);
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong. Please try again.');
    }
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 space-y-4" role="status">
        <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h3 className="text-2xl font-black text-foreground">{successTitle}</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{successMessage}</p>
        <Button
          variant="outline"
          onClick={() => {
            setSubmitted(false);
            reset();
          }}
          className="mt-2 rounded-xl border-border/80"
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      <div className="space-y-1 mb-1">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-name" className="text-xs font-bold text-foreground">Full name</label>
        <Input
          id="contact-name"
          autoComplete="name"
          placeholder="e.g. Ahmed Al-Mansoor"
          aria-invalid={!!errors.name}
          {...register('name', { required: 'Please enter your name.' })}
          className={`h-10 ${fieldClass}`}
        />
        <ErrorMsg message={errors.name?.message} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className="text-xs font-bold text-foreground">Email address</label>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            placeholder="ahmed@example.com"
            aria-invalid={!!errors.email}
            {...register('email', { required: 'Please enter your email.' })}
            className={`h-10 ${fieldClass}`}
          />
          <ErrorMsg message={errors.email?.message} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contact-phone" className="text-xs font-bold text-foreground">Phone <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+20 10 000 000 00"
            {...register('phone')}
            className={`h-10 ${fieldClass}`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="text-xs font-bold text-foreground">Your message</label>
        <Textarea
          id="contact-message"
          rows={3}
          placeholder="How can we help with your family’s learning goals?"
          aria-invalid={!!errors.message}
          {...register('message', { required: 'Please write a message.' })}
          className={`${fieldClass} resize-none`}
        />
        <ErrorMsg message={errors.message?.message} />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full h-11 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl mt-1"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <span>Sending…</span>
          </>
        ) : (
          <>
            <span>Send message</span>
            <Send className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </form>
  );
}
