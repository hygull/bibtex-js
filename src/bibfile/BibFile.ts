import * as nearley from "nearley";

import {grammar} from "../parser/ts-parser";

import Lexer from "../lexer/Lexer";
import {isArray, mustBeString} from "../util";
import {isKeyVal} from "./KeyVal";
import {BibEntry, FieldValue, isBibEntry, parseEntryFields} from "./BibEntry";
import {BibComment, CommentEntry, flattenPlainText, isBibComment} from "./BibComment";
import {isPreamble, Preamble, newPreambleNode} from "./BibPreamble";
import {newStringNode, resolveStrings, StringEntry} from "./string/StringEntry";


export type NonBibComment = BibEntry | CommentEntry | StringEntry | Preamble;


/**
 * A bibfile is a sequence of entries, with comments interspersed
 */
export class BibFile {
    readonly content: (NonBibComment | BibComment)[];
    readonly comments: BibComment[];

    readonly entries: BibEntry[];
    readonly entries$: { [key: string]: BibEntry };

    /**
     * Anything declared in a @preamble command will be concatenated and put in a variable
     named preamble$, for being used in the bibliography style and, generally, inserted at the beginning of
     the .bbl file, just before the thebibliography environment. This is useful for defining new commands
     used in the bibliography. Here is a small example:

     \@preamble{ "\makeatletter" }
     \@preamble{ "\@ifundefined{url}{\def\url#1{\texttt{#1}}}{}" }
     \@preamble{ "\makeatother" }

     This way, you may safely use the \url command in your entries. If it is not defined at the beginning
     of the bibliography, the default command defined in the @preamble will be used.
     Please note that you should never define style settings in the @preamble of a bibliography database,
     since it would be applied to any bibliography built from this database.
     */
    readonly preambles: Preamble[];
    readonly preamble$: string;

    readonly strings: { [k: string]: FieldValue };
    /**
     * `strings`, but with all references resolved
     */
    readonly strings$: { [k: string]: FieldValue };


    constructor(content: (NonBibComment | BibComment)[]) {
        this.content = content;
        this.comments = content.filter(isBibComment).map(c => {
            if (isBibComment(c))return c; else throw new Error();
        });


        this.entries = content.filter(c => isBibEntry(c)).map(c => {
            if (isBibEntry(c)) return c; else throw new Error();
        });

        const entryMap: { [k: string]: BibEntry } = {};
        this.entries.forEach((entry: BibEntry) => {
            const key = entry._id.toLowerCase();
            /**
             * BibTEX will complain if two entries have the same internal key, even if they aren’t capitalized in the same
             * way. For instance, you cannot have two entries named Example and example.
             * In the same way, if you cite both example and Example, BibTEX will complain. Indeed, it would
             * have to include the same entry twice, which probably is not what you want
             */
            if (!!entryMap[key]) throw new Error("Entry with id " + key + " was defined more than once");
            entryMap[key] = entry;
        });
        this.entries$ = entryMap;

        this.preambles = content.filter(c => isPreamble(c)).map(c => {
            if (isPreamble(c)) return c; else throw new Error();
        });
        this.preamble$ = this.preambles.map(p => p.toString()).join("\n");

        const strings: { [k: string]: FieldValue } = {};
        this.content.forEach(entry => {
                if (isKeyVal(entry)) strings[entry.key] = entry.value;
            }
        );
        this.strings = strings;
        this.strings$ = resolveStrings(strings);

        console.log("Parsefd")
    }

    getEntry(id: string): BibEntry | undefined {
        return this.entries$[id.toLowerCase()];
    }
}

function parseNonEntry(nonEntry: any): BibComment {
    if (!isArray(nonEntry.data) || nonEntry.type !== "NON_ENTRY") throw new Error();
    return new BibComment(flattenPlainText(nonEntry.data));
}


function parseEntry(entry: any): NonBibComment {
    switch (typeof entry) {
        case "object":
            let data = entry.data;
            if (typeof data["@type"] === "string") {
                return new BibEntry(data["@type"], data._id, parseEntryFields(data.fields));
            }

            let type = mustBeString(data.type);
            switch (type) {
                case "string":
                    return newStringNode(data);
                case "preamble":
                    return newPreambleNode(data);
                // case "bracedstringwrapper":
                //     return new BracedString(parseComplexStringOuter(data));
                // case "quotedstringwrapper":
                //     return new QuotedString(parseComplexStringOuter(data));
                // case "braced":
                // case "quotedstring":
                default:
                    throw new Error("Unexpected entry parsed: " + data.type);
            }
        default:
            throw new Error("Expected object as data for entry");
    }
}

export const parseBibEntriesAndNonEntries = function (parse: any): (BibComment | NonBibComment)[] {
    return parse.map((entity: any) => {
        switch (entity.type) {
            case "NON_ENTRY":
                return (parseNonEntry(entity));
            case "ENTRY":
                return (parseEntry(entity));
            default:
                throw new Error("Expected ENTRY or NON_ENTRY");
        }
    });
};

export function parseBibFile(input: string): BibFile {
    const p = new nearley.Parser(grammar.ParserRules, grammar.ParserStart);
    p.feed(new Lexer(input).readTokens());
    const res = p.results;
    const parse = res[0];

    return new BibFile(parseBibEntriesAndNonEntries(parse));
}
