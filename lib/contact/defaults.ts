import type { BusinessHourRecord, ContactInfoFields, FaqRecord } from "./types";

/**
 * Built-in Contact page content.
 *
 * This is the single source of truth for "what the page says before anyone has
 * edited it". It is used in three places:
 *   1. the public /contact page, until the first save from the dashboard;
 *   2. the default values of the dashboard forms;
 *   3. seeding the database rows on the first save.
 *
 * Phone / WhatsApp / coordinates are placeholders in a realistic format —
 * replace them from /dashboard/contact/contact-info.
 */
export const DEFAULT_CONTACT_INFO: ContactInfoFields = {
    heroBadgeText: "Support team online",
    heroHeadline: "Let’s find the right Quran and Arabic tutor for your family",
    heroDescription:
        "Questions about choosing a teacher, lesson times or how progress is tracked? Send us a message and a real person from our team will reply personally.",

    phoneLabel: "Call us",
    phoneNumber: "+20 100 000 0000",
    phoneNote: "Answered during business hours",

    supportEmailLabel: "Email us",
    supportEmail: "support@easyarabic.com",
    supportEmailNote: "We reply to every message",

    billingEmail: "billing@easyarabic.com",

    whatsappNumber: "201000000000",
    whatsappTitle: "Prefer a quick chat?",
    whatsappDescription: "Message us on WhatsApp and we’ll answer as soon as we’re available.",
    whatsappButtonLabel: "Chat on WhatsApp",
    whatsappPrefilledMessage: "Hello Easy Arabic, I’d like to know more about your lessons.",

    officeName: "Easy Arabic Head Office",
    addressLine1: "12 Mosaddak Street",
    addressLine2: "Dokki",
    city: "Giza",
    stateRegion: "Giza Governorate",
    postalCode: "12611",
    country: "Egypt",
    latitude: 30.0386,
    longitude: 31.2108,

    timezone: "Africa/Cairo",
    businessHoursNote: "Closed on Fridays and public holidays. Messages sent outside these hours are answered the next working day.",

    responseTime: "Within one business day",
    supportLanguages: "Arabic & English",
    trialLessonText: "Ask about a trial lesson",

    formTitle: "Send us a message",
    formDescription: "Tell us a little about your family and what you’re looking for, and we’ll get back to you.",
    formSuccessTitle: "Message received",
    formSuccessMessage: "Thank you for reaching out. A member of our team will reply to you by email soon.",

    faqTitle: "Frequently asked questions",
    faqDescription: "Quick answers to what families ask us most before they get started.",

    facebookUrl: "https://www.facebook.com/easyarabic",
    instagramUrl: "https://www.instagram.com/easyarabic",
    linkedinUrl: "https://www.linkedin.com/company/easyarabic",
    xUrl: "https://x.com/easyarabic",
    whatsappUrl: "https://wa.me/201000000000",

    showContentSection: true,
    showChannelsSection: true,
    showLocationSection: true,
    showHoursSection: true,
    showSocialSection: true,
    showFaqsSection: true,
};

/** Sat–Thu 09:00–21:00 (Cairo), Friday closed. Index = dayOfWeek (0 = Sunday). */
export const DEFAULT_BUSINESS_HOURS: BusinessHourRecord[] = [
    { dayOfWeek: 0, isOpen: true, opensAt: "09:00", closesAt: "21:00" },
    { dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "21:00" },
    { dayOfWeek: 2, isOpen: true, opensAt: "09:00", closesAt: "21:00" },
    { dayOfWeek: 3, isOpen: true, opensAt: "09:00", closesAt: "21:00" },
    { dayOfWeek: 4, isOpen: true, opensAt: "09:00", closesAt: "21:00" },
    { dayOfWeek: 5, isOpen: false, opensAt: null, closesAt: null },
    { dayOfWeek: 6, isOpen: true, opensAt: "09:00", closesAt: "21:00" },
];

export const DEFAULT_FAQS: FaqRecord[] = [
    {
        id: "default-faq-1",
        question: "How quickly can my family get started?",
        answer:
            "After you contact us, we learn about your goals and your children’s levels, then suggest a tutor. Most families are matched and scheduled within a few days.",
        sortOrder: 0,
        isPublished: true,
    },
    {
        id: "default-faq-2",
        question: "Can we choose a male or female tutor?",
        answer:
            "Yes. Tell us your preference when you contact us and we will only suggest tutors who match it, along with the language they teach in.",
        sortOrder: 1,
        isPublished: true,
    },
    {
        id: "default-faq-3",
        question: "How do lessons work across different time zones?",
        answer:
            "Lessons are held online at a time that suits your family’s time zone. Every lesson is recorded on the platform, so you can follow attendance and progress at any time.",
        sortOrder: 2,
        isPublished: true,
    },
    {
        id: "default-faq-4",
        question: "Is there a trial lesson?",
        answer:
            "Ask our team about a trial lesson when you get in touch — we will confirm what is available for your family before you commit to anything.",
        sortOrder: 3,
        isPublished: true,
    },
];

export const DEFAULT_CONTACT_PAGE_CONTENT = {
    info: DEFAULT_CONTACT_INFO,
    hours: DEFAULT_BUSINESS_HOURS,
    faqs: DEFAULT_FAQS,
};
