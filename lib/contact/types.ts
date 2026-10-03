/**
 * Shapes of the public Contact page content. They mirror the `ContactInfo`,
 * `ContactBusinessHour` and `ContactFaq` models in prisma/contract.prisma.
 */

export const CONTACT_INFO_ID = "default";

export type ContactInfoRecord = {
    id: string;

    heroBadgeText: string;
    heroHeadline: string;
    heroDescription: string;

    phoneLabel: string;
    phoneNumber: string;
    phoneNote: string;

    supportEmailLabel: string;
    supportEmail: string;
    supportEmailNote: string;

    billingEmail: string | null;

    whatsappNumber: string | null;
    whatsappTitle: string;
    whatsappDescription: string;
    whatsappButtonLabel: string;
    whatsappPrefilledMessage: string;

    officeName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    stateRegion: string | null;
    postalCode: string | null;
    country: string;
    latitude: number;
    longitude: number;

    timezone: string;
    businessHoursNote: string;

    responseTime: string;
    supportLanguages: string;
    trialLessonText: string;

    formTitle: string;
    formDescription: string;
    formSuccessTitle: string;
    formSuccessMessage: string;

    faqTitle: string;
    faqDescription: string;

    facebookUrl: string | null;
    instagramUrl: string | null;
    linkedinUrl: string | null;
    xUrl: string | null;
    whatsappUrl: string | null;

    /** One flag per dashboard section: false hides that section on the public /contact page. */
    showContentSection: boolean;
    showChannelsSection: boolean;
    showLocationSection: boolean;
    showHoursSection: boolean;
    showSocialSection: boolean;
    showFaqsSection: boolean;

    updatedAt: string;
};

/** The editable fields of a ContactInfo row (everything except bookkeeping columns). */
export type ContactInfoFields = Omit<ContactInfoRecord, "id" | "updatedAt">;

/** dayOfWeek: 0 = Sunday … 6 = Saturday. opensAt / closesAt are 24h "HH:MM". */
export type BusinessHourRecord = {
    dayOfWeek: number;
    isOpen: boolean;
    opensAt: string | null;
    closesAt: string | null;
};

export type FaqRecord = {
    id: string;
    question: string;
    answer: string;
    sortOrder: number;
    isPublished: boolean;
};

export type ContactPageContent = {
    info: ContactInfoFields;
    /** Always exactly 7 entries, ordered Sunday → Saturday. */
    hours: BusinessHourRecord[];
    faqs: FaqRecord[];
    /**
     * "database"  – read from PostgreSQL.
     * "defaults"  – nothing saved yet, showing the built-in defaults.
     * "fallback"  – the database could not be read, showing the defaults.
     */
    source: "database" | "defaults" | "fallback";
};
