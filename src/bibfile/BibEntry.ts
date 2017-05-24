import {BibFileNode} from "./BibFileNode";
import {parseNode} from "./parseBibNode";

export class BibEntry implements NonBibComment {
    readonly type: string;
    readonly _id: string;
    readonly fields: EntryFields;
    
    constructor(type: string, id: string, fields: EntryFields){
      this.type = type;
      this._id = id;
      this.fields = fields;
    }
}


export function parseEntryFields(fields: any): EntryFields {
    const fieldz: EntryFields = {};
    Object.keys(fields).forEach(key => {
        fieldz[key] = parseNode(fields[key]);
    });
    return fieldz;
}



export function parseFieldValue(value: any): FieldValue {
    switch(value.type){
        case "quotedstringwrapper":
            return new OuterQuotedString();
            case "bracedstringwrapper":
            return new OuterBracedString();
        default:
            throw new Error();
    }
}

export type FieldValue = number | string | OuterQuotedString | OuterBracedString;


export type EntryFields = { [k: string]: FieldValue };

export function isBibEntry(x: any): x is BibEntry {
    return typeof x["@type"] === "string"
        && typeof x["_id"] === "string"
        && !!x["fields"];
}
