'use server';
import { prismaArgs } from "@/lib/prismaArgs";
import { db } from "@/prisma/db";
import { authorization } from "../verifyAuth";
import { ContactMessage } from "@/stores/admin/contacts";
export const getContacts = prismaArgs<'Contact'>('Contact');

export const updateContact = async (contactId: string, data: Partial<ContactMessage>) => {
    try {
        const { error } = await authorization(['admin']);
        if (error) {
            return {
                success: false,
                error: { code: "FORBIDDEN", message: "Forbidden" }
            }
        }
        const contact = await db.orm.public.Contact.where({ id: contactId }).update({
            ...data
        })
        return {
            success: true,
            contact: contact,
            message: 'Message successfully updated'
        };
    } catch (error) {
        console.error("updateContact function:", error);
        return {
            success: false,
            error: { code: "SERVER_ERROR", message: "Error in server" },
        };
    }
}
export const deleteContact = async (contactId: string) => {
    try {
        const { error } = await authorization(['admin']);
        if (error) {
            return {
                success: false,
                error: { code: "FORBIDDEN", message: "Forbidden" }
            }
        }
        await db.orm.public.Contact.where({ id: contactId }).delete()
        return {
            success: true,
            message: 'Message successfully deleted'
        };
    } catch (error) {
        console.error("deleteContact function:", error);
        return {
            success: false,
            error: { code: "SERVER_ERROR", message: "Error in server" },
        };
    }
}