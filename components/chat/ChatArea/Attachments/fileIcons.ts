import {
    FileArchiveIcon,
    FileIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    PresentationIcon,
    type LucideIcon,
} from "lucide-react";
import { getFileExtension } from "../../lib/attachments";

export interface FileVisual {
    Icon: LucideIcon;
    /** Colours for the icon box on a received message. */
    tone: string;
    /** Short type label for the card: "PDF", "DOCX"... */
    label: string;
}

const VISUALS: Array<{ extensions: string[]; Icon: LucideIcon; tone: string }> = [
    { extensions: ["pdf"], Icon: FileTextIcon, tone: "bg-red-500/15 text-red-600 dark:text-red-400" },
    { extensions: ["doc", "docx", "odt", "rtf"], Icon: FileTextIcon, tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    { extensions: ["xls", "xlsx", "ods", "csv"], Icon: FileSpreadsheetIcon, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { extensions: ["ppt", "pptx", "odp"], Icon: PresentationIcon, tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
    { extensions: ["zip"], Icon: FileArchiveIcon, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
];

/** Icon, colour and label for a document, chosen by its extension. */
export function getFileVisual(fileName?: string): FileVisual {
    const extension = fileName ? getFileExtension(fileName) : "";
    const match = VISUALS.find((visual) => visual.extensions.includes(extension));
    return {
        Icon: match?.Icon ?? (extension === "txt" ? FileTextIcon : FileIcon),
        tone: match?.tone ?? "bg-primary/10 text-primary",
        label: extension ? extension.toUpperCase() : "FILE",
    };
}
