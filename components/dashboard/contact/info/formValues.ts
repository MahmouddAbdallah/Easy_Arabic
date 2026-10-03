import type { BusinessHourRecord, ContactInfoFields, FaqRecord } from '@/lib/contact/types';
import type {
    ContactChannelsValues,
    ContactContentValues,
    ContactFaqsValues,
    ContactHoursValues,
    ContactLocationValues,
    ContactSocialValues,
} from '@/lib/contact/validation';

/** Database rows → form values (NULL columns become empty strings so inputs stay controlled). */

export const toContentValues = (i: ContactInfoFields): ContactContentValues => ({
    heroBadgeText: i.heroBadgeText,
    heroHeadline: i.heroHeadline,
    heroDescription: i.heroDescription,
    responseTime: i.responseTime,
    supportLanguages: i.supportLanguages,
    trialLessonText: i.trialLessonText,
    formTitle: i.formTitle,
    formDescription: i.formDescription,
    formSuccessTitle: i.formSuccessTitle,
    formSuccessMessage: i.formSuccessMessage,
    faqTitle: i.faqTitle,
    faqDescription: i.faqDescription,
    showContentSection: i.showContentSection,
});

export const toChannelsValues = (i: ContactInfoFields): ContactChannelsValues => ({
    phoneLabel: i.phoneLabel,
    phoneNumber: i.phoneNumber,
    phoneNote: i.phoneNote,
    supportEmailLabel: i.supportEmailLabel,
    supportEmail: i.supportEmail,
    supportEmailNote: i.supportEmailNote,
    billingEmail: i.billingEmail ?? '',
    whatsappNumber: i.whatsappNumber ?? '',
    whatsappTitle: i.whatsappTitle,
    whatsappDescription: i.whatsappDescription,
    whatsappButtonLabel: i.whatsappButtonLabel,
    whatsappPrefilledMessage: i.whatsappPrefilledMessage,
    showChannelsSection: i.showChannelsSection,
});

export const toLocationValues = (i: ContactInfoFields): ContactLocationValues => ({
    officeName: i.officeName,
    addressLine1: i.addressLine1,
    addressLine2: i.addressLine2 ?? '',
    city: i.city,
    stateRegion: i.stateRegion ?? '',
    postalCode: i.postalCode ?? '',
    country: i.country,
    latitude: i.latitude,
    longitude: i.longitude,
    showLocationSection: i.showLocationSection,
});

export const toHoursValues = (i: ContactInfoFields, hours: BusinessHourRecord[]): ContactHoursValues => ({
    timezone: i.timezone,
    businessHoursNote: i.businessHoursNote,
    hours: hours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        isOpen: h.isOpen,
        opensAt: h.opensAt ?? '',
        closesAt: h.closesAt ?? '',
    })),
    showHoursSection: i.showHoursSection,
});

export const toSocialValues = (i: ContactInfoFields): ContactSocialValues => ({
    facebookUrl: i.facebookUrl ?? '',
    instagramUrl: i.instagramUrl ?? '',
    linkedinUrl: i.linkedinUrl ?? '',
    xUrl: i.xUrl ?? '',
    whatsappUrl: i.whatsappUrl ?? '',
    showSocialSection: i.showSocialSection,
});

export const toFaqsValues = (i: ContactInfoFields, faqs: FaqRecord[]): ContactFaqsValues => ({
    faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, isPublished: f.isPublished })),
    showFaqsSection: i.showFaqsSection,
});
