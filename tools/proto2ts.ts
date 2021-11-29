import fs from "fs";

interface Opts {
    bytesType: string;
    typeJoinSeq: string;
}

interface ProtoObj {
    _interfaceType: string;

    /**
     * Similar to Java package paths, will be `[Ancestor, SubMessage]`
     * for a message called `ThisMessage` nested within a message called `SubMessage`.
     */
    typePath: string[];

    /**
     * Similar to Java package paths, will be `ThisMessage`
     * for a message called `ThisMessage` nested within a message called `SubMessage`.
     */
    name: string;

    fields: Record<string, unknown>[];
}

interface ProtoEnum extends ProtoObj {
    _interfaceType: "enum";

    fields: {
        name: string;
        value: number;
    }[];
}

interface ProtoMessage extends ProtoObj {
    _interfaceType: "message";

    fields: {
        isRequired: boolean;
        isArray: boolean;
        name: string;
        typePath: string[];
        typeName: string;
    }[];
}

type ProtoType = ProtoEnum | ProtoMessage;

/**
 * Return fully qualified type name for specified path and type.
 */
function toFullName(opts: Opts, typePath: string[], typeName: string): string {
    return [...typePath, typeName.replace(/\./g, opts.typeJoinSeq)].join(opts.typeJoinSeq);
}

function resolveType(opts: Opts, types: Map<string, ProtoType>, typePath: string[], typeName: string): string {
    // always resolve primitives first
    const primitives = new Map([
        ["double", "number"],
        ["float", "number"],
        ["int32", "number"],
        ["int64", "number"],
        ["uint32", "number"],
        ["uint64", "number"],
        ["sint32", "number"],
        ["sint64", "number"],
        ["fixed32", "number"],
        ["fixed64", "number"],
        ["sfixed32", "number"],
        ["sfixed64", "number"],
        ["bool", "boolean"],
        ["string", "string"],
        ["bytes", opts.bytesType],
    ]);
    const prim = primitives.get(typeName);
    if (prim != null) {
        return prim;
    }

    // find longest matching type path
    for (let i = typePath.length; i >= 0; i--) {
        const fullName = toFullName(opts, typePath.slice(0, i), typeName);
        if (types.has(fullName)) {
            return fullName;
        }
    }

    // failed to find type
    const fullName = toFullName(opts, typePath, typeName);
    console.warn(`Could not find type for ${fullName}`);
    return fullName;
}

function processLines(
    opts: Opts,
    types: Map<string, ProtoType>,
    typePath: string[],
    lineParts: string[][],
    start: number,
    end: number,
    type: "file" | "message" | "enum",
    name: string,
): void {
    let obj: null | ProtoType = null;
    if (type !== "file") {
        obj = {
            _interfaceType: type,
            typePath,
            name,
            fields: [],
        };
        types.set(toFullName(opts, typePath, name), obj);
    }
    const nextTypePath = type === "file" ? typePath : [...typePath, name];

    for (let i = start; i < end; i++) {
        const parts = lineParts[i];
        const [firstWord] = parts;

        // ignore curly braces
        if (["{", "}"].includes(firstWord)) continue;

        // ignore lines starting with these keywords
        if (["syntax", "package", "option", "extensions", "reserved"].includes(firstWord)) {
            continue;
        }

        // new enum or message
        if (firstWord === "enum" || firstWord === "message") {
            i += 2; // skip this line and the following opening curly brace
            const newStart = i;
            let openCurlyBraceCount = 1;
            while (openCurlyBraceCount > 0) {
                i++;
                if (lineParts[i][0] === "{") openCurlyBraceCount++;
                if (lineParts[i][0] === "}") openCurlyBraceCount--;
            }
            processLines(opts, types, nextTypePath, lineParts, newStart, i, firstWord, parts[1]);
            continue;
        }

        // enum specific fields
        if (obj?._interfaceType === "enum") {
            // enum field
            obj.fields.push({
                name: parts[0],
                value: Number.parseInt(parts[2]),
            });
            continue;
        }

        // message specific fields
        if (obj?._interfaceType === "message") {
            // singular field
            if (["required", "optional"].includes(parts[0])) {
                obj.fields.push({
                    isRequired: parts[0] === "required",
                    isArray: false,
                    name: parts[2],
                    typePath: nextTypePath,
                    typeName: parts[1],
                });
                continue;
            }

            // repeated field
            if (parts[0] === "repeated") {
                obj.fields.push({
                    isRequired: true,
                    isArray: true,
                    name: parts[2],
                    typePath: nextTypePath,
                    typeName: parts[1],
                });
                continue;
            }
        }

        console.warn(`Unable to process line: ${parts.join(" ")}`);
    }
}

function createOutput(opts: Opts, types: Map<string, ProtoType>): string {
    // sort lexicographically
    const typesArr = [...types.entries()];
    typesArr.sort(([a], [b]) => {
        if (b.startsWith(a)) return -1;
        if (a.startsWith(b)) return 1;
        return a.localeCompare(b);
    });

    const output: string[] = [];
    for (const [k, v] of typesArr) {
        switch (v._interfaceType) {
            case "enum": {
                output.push(`export const enum ${k} {`);
                v.fields.sort((a, b) => a[1] - b[1]);
                for (const { name, value } of v.fields) {
                    output.push(`    ${name} = ${value},`);
                }
                output.push("}\n");
                break;
            }
            case "message": {
                output.push(`export interface ${k} {`);
                for (const { isRequired, name, typePath, typeName, isArray } of v.fields) {
                    const type = resolveType(opts, types, typePath, typeName) + (isArray ? "[]" : "");
                    const required = isRequired ? "" : "?";
                    output.push(`    ${name}${required}: ${type};`);
                }
                output.push("}\n");
                break;
            }
            default:
                throw new Error(`Could not convert ${k} to TypeScript`);
        }
    }

    return output.join("\n");
}

function processText(opts: Opts, text: string): string {
    const lines = text
        // remove block comments
        .replace(/\/\*.*?\*\//g, "")
        // remove line comments
        .replace(/\/\/.*?\n/g, "")
        // normalize whitespace
        .replace(/\s+/g, " ")
        // split by semi-colons and curly braces
        .replace(/([;{}])/g, "\n$1\n")
        .split(/\n/g)
        // trim whitespace
        .map(l => l.trim())
        // remove empty statements
        .filter(l => l.length > 0 && l !== ";");

    const parts = lines.map(l => l.split(" "));

    const types = new Map();
    processLines(opts, types, [], parts, 0, parts.length, "file", null);

    return createOutput(opts, types);
}

function processFile(opts: Opts, protoPath: string): void {
    let text: string;
    try {
        text = fs.readFileSync(protoPath, { encoding: "utf8" });
    }
    catch (e) {
        console.error(e);
        return;
    }
    console.log(`Processing: ${protoPath}`);

    const output = processText(opts, text);
    fs.writeFileSync(`${protoPath.replace(/\.proto$/, "")}.d.ts`, output);
}

(() => {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.log("Usage: proto2ts.js file.proto file2.proto file3.proto");
        return;
    }

    const opts: Opts = {
        bytesType: "Uint8Array",
        typeJoinSeq: "$",
    };

    for (const file of files) {
        try {
            processFile(opts, file);
        }
        catch (e) {
            console.error(`Error processing ${file}`, e);
        }
    }
})();
