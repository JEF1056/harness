import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
const MAX_TOKENS = 10000;
const MAX_CHARS = 40000;
const DEFAULT_EXCLUDES = ["node_modules", ".git", ".agents", "dist", "build", ".next", ".nuxt", ".output", "vendor", "target", "out", ".wrangler", ".husky", ".cache", "coverage", ".turbo"];
const SOURCE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rs", ".go", ".rb", ".java", ".cs", ".php"];
export const CODEBASE_MAP_PROMPT = `You are enriching the machine-generated codebase map at CODEBASE_MAP.md. The deterministic sections (Project Overview, Directory Structure, Key Files, Module Deep-Dives, Key Interfaces & APIs, Configuration, Freshness) are already built — do NOT rewrite them. Your job:

1. Read CODEBASE_MAP.md.
2. For each module in "Module Deep-Dives", read the top 1-2 key files and add a "Data flow / call chains" bullet: entry point -> core functions -> persistence/IO. One line per chain, file:line references.
3. Verify "Key Interfaces & APIs" against the actual code. Fix any signature that is wrong. Add missing public exports ONLY if a module lists a public API surface in its package.json "main"/"exports"/"bin".
4. In the Freshness section, replace "- Enrichment status: PENDING (explorer must run /map again after significant refactors)" with a one-line note of what you verified and any corrections you made.
5. Keep the whole document under ${MAX_TOKENS} tokens. If you must cut, cut Directory Structure depth first, never the Freshness section.
6. Do NOT create handoff.md. Do NOT create files under .agents/. Edit CODEBASE_MAP.md in place only.`;
export function build_codebase_map(workspaceRoot, options) {
    const excludeDirs = [...DEFAULT_EXCLUDES];
    const agentsDir = options?.agentsDir || path.join(workspaceRoot, ".agents");
    const scope = options?.scope || null;
    const sourceFiles = scanSourceFiles(workspaceRoot, excludeDirs);
    const dirTree = buildDirectoryTree(workspaceRoot, excludeDirs);
    const keyFiles = identifyKeyFiles(workspaceRoot, excludeDirs);
    const entryPoints = identifyEntryPoints(workspaceRoot, excludeDirs);
    const modules = identifyModules(workspaceRoot, excludeDirs);
    const interfaces = extractInterfaces(workspaceRoot, excludeDirs, sourceFiles);
    const config = extractConfig(workspaceRoot, excludeDirs);
    const freshness = readFreshness(workspaceRoot);
    const nowIso = new Date().toISOString();
    // Ensure map modules detail directory exists and persist detail files
    const modulesDir = path.join(agentsDir, "map_modules");
    try {
        fs.mkdirSync(modulesDir, { recursive: true });
    }
    catch { }
    for (const mod of modules) {
        const detail = buildModuleDetail(workspaceRoot, mod);
        try {
            fs.writeFileSync(path.join(modulesDir, `${slugify(mod.name)}.md`), detail, "utf8");
        }
        catch { }
    }
    let doc = `<!-- tokens: overview=0, dir=0, modules=0, interfaces=0, config=0, changes=0 -->\n`;
    doc += `# Codebase Map\n\n`;
    doc += `## Project Overview\n\n`;
    doc += `- **Language**: ${detectLanguage(sourceFiles)}\n`;
    doc += `- **Framework**: ${detectFramework(workspaceRoot, excludeDirs)}\n`;
    doc += `- **Build System**: ${detectBuildSystem(workspaceRoot, excludeDirs)}\n`;
    doc += `- **Entry Points**: ${entryPoints.length > 0 ? entryPoints.slice(0, 5).map(p => `\`${rel(workspaceRoot, p)}\``).join(", ") : "None detected"}\n`;
    doc += `\n`;
    doc += `## Directory Structure\n\n\`\`\`\n${dirTree}\n\`\`\`\n\n`;
    if (keyFiles.length > 0) {
        doc += `## Key Files\n\n`;
        for (const kf of keyFiles.slice(0, 20)) {
            doc += `- \`${rel(workspaceRoot, kf)}\`\n`;
        }
        doc += `\n`;
    }
    if (modules.length > 0) {
        doc += `## Module Deep-Dives\n\n`;
        for (const mod of modules.slice(0, 8)) {
            doc += `### ${mod.name}\n\n`;
            doc += `- **Purpose**: ${mod.purpose}\n`;
            doc += `- **Key Files**: ${mod.keyFiles.slice(0, 6).map(f => `\`${rel(workspaceRoot, f)}\``).join(", ")}\n`;
            doc += `- **Dependencies**: ${mod.dependencies.slice(0, 8).join(", ") || "None"}\n`;
            doc += `- **Detail**: \`.agents/map_modules/${slugify(mod.name)}.md\`\n\n`;
        }
    }
    if (interfaces.length > 0) {
        doc += `## Key Interfaces & APIs\n\n`;
        const byModule = {};
        for (const group of interfaces) {
            const arr = byModule[group.module] || [];
            for (const sig of group.signatures) {
                arr.push({ sig, file: group.file });
            }
            byModule[group.module] = arr;
        }
        const moduleOrder = Object.keys(byModule).sort((a, b) => byModule[b].length - byModule[a].length).slice(0, 6);
        for (const modName of moduleOrder) {
            doc += `### ${modName}\n\n`;
            const seenSigs = new Set();
            let count = 0;
            for (const item of byModule[modName]) {
                if (seenSigs.has(item.sig) || count >= 15)
                    continue;
                seenSigs.add(item.sig);
                doc += `- \`${item.sig}\` — \`${rel(workspaceRoot, item.file)}\`\n`;
                count++;
            }
            doc += `\n`;
        }
    }
    if (config.length > 0) {
        doc += `## Configuration\n\n`;
        for (const c of config) {
            doc += `- ${c}\n`;
        }
        doc += `\n`;
    }
    doc += `## Freshness\n\n`;
    doc += `- Last regenerated: ${nowIso}\n`;
    doc += `- Scope: ${scope || "Full project"}\n`;
    if (freshness) {
        doc += `- Git commit at last regeneration: ${freshness.gitCommit}${freshness.dirty ? " (dirty)" : ""}\n`;
    }
    if (options?.enrichmentNote) {
        doc += `- Enrichment status: VERIFIED\n`;
        doc += `- Enrichment note: ${options.enrichmentNote}\n\n`;
    }
    else {
        doc += `- Enrichment status: PENDING (explorer must run /map again after significant refactors)\n\n`;
    }
    doc = prune(doc, { maxTokens: MAX_TOKENS, maxChars: MAX_CHARS });
    return doc;
}
function rel(root, p) {
    return path.relative(root, p).replace(/\\/g, "/");
}
function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function scanSourceFiles(root, excludes, maxDepth = 6) {
    const results = [];
    function scan(dir, depth) {
        if (depth > maxDepth)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (excludes.includes(entry.name))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory())
                scan(fullPath, depth + 1);
            else if (SOURCE_EXTS.some(ext => entry.name.endsWith(ext)))
                results.push(fullPath);
        }
    }
    scan(root, 0);
    return results;
}
function buildDirectoryTree(root, excludes, depth = 0) {
    let tree = "";
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    }
    catch {
        return tree;
    }
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory())
            return -1;
        if (!a.isDirectory() && b.isDirectory())
            return 1;
        return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
        if (excludes.includes(entry.name))
            continue;
        if (entry.isDirectory()) {
            const full = path.join(root, entry.name);
            const count = countFiles(full, excludes);
            const interesting = depth <= 1 || count.files > 0 || entry.name.match(/^(src|lib|packages|apps|app|components|services|utils|core|shared|api|server|client|web|tools|scripts|mcp|docs|config|infra|test|spec|workers|routes)$/i);
            if (depth < 4 && interesting) {
                const subTree = buildDirectoryTree(full, excludes, depth + 1);
                tree += `${"  ".repeat(depth)}├── ${entry.name}/\n${subTree}`;
            }
            else {
                tree += `${"  ".repeat(depth)}├── ${entry.name}/ (${count.files} files, ${count.dirs} subdirs)\n`;
            }
        }
        else {
            tree += `${"  ".repeat(depth)}├── ${entry.name}\n`;
        }
    }
    return tree;
}
function countFiles(dir, excludes) {
    let files = 0, dirs = 0;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return { files: 0, dirs: 0 };
    }
    for (const e of entries) {
        if (excludes.includes(e.name))
            continue;
        if (e.isDirectory())
            dirs++;
        else
            files++;
    }
    return { files, dirs };
}
function identifyKeyFiles(root, excludes) {
    const keyNames = [
        "package.json", "tsconfig.json", "docker-compose.yml", "docker-compose.yaml", "Dockerfile",
        "Makefile", "Cargo.toml", "go.mod", "pyproject.toml", "requirements.txt",
        "Gemfile", "build.gradle", "pom.xml", "CMakeLists.txt", "mix.exs",
        "vite.config.ts", "vite.config.js", "webpack.config.js", "next.config.js", "nuxt.config.ts",
        "jest.config.js", "jest.config.ts", "vitest.config.ts", "tailwind.config.js", "postcss.config.js", "babel.config.js",
        "eslint.config.js", ".eslintrc", ".prettierrc", "wrangler.toml", "wrangler.jsonc",
        "README.md", ".gitignore", "renovate.json", "nx.json", "turbo.json", "pnpm-workspace.yaml",
        "lerna.json", "svelte.config.js", "astro.config.mjs", "remix.config.js",
        "fly.toml", "render.yaml", "vercel.json", "netlify.toml", "Taskfile.yml", "justfile",
    ];
    const keyFiles = [];
    const seen = new Set();
    for (const name of keyNames) {
        const fullPath = path.join(root, name);
        if (fs.existsSync(fullPath) && !seen.has(fullPath)) {
            seen.add(fullPath);
            keyFiles.push(fullPath);
        }
    }
    const patterns = [
        { base: "tsconfig*.json" }, { base: "wrangler.toml" }, { base: "wrangler.jsonc" },
        { base: "vite.config.*" }, { base: "webpack.config.*" }, { base: "jest.config.*" },
        { base: "vitest.config.*" }, { base: "Dockerfile*" },
    ];
    for (const { base } of patterns) {
        const regex = new RegExp(`^${base.replace(/\*/g, ".*").replace(/\./g, "\\.")}$`);
        for (const f of scanSourceFiles(root, excludes, 3)) {
            if (regex.test(path.basename(f)) && !seen.has(f)) {
                seen.add(f);
                keyFiles.push(f);
            }
        }
    }
    return keyFiles;
}
function identifyEntryPoints(root, excludes) {
    const entryPoints = [];
    const seen = new Set();
    const addEntry = (fp) => {
        if (fs.existsSync(fp) && !seen.has(fp)) {
            seen.add(fp);
            entryPoints.push(fp);
        }
    };
    const pkgFiles = [];
    function findPkgs(dir, depth) {
        if (depth > 4)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (excludes.includes(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                findPkgs(full, depth + 1);
            else if (entry.name === "package.json")
                pkgFiles.push(full);
        }
    }
    findPkgs(root, 0);
    for (const pkgPath of pkgFiles) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const pkgDir = path.dirname(pkgPath);
            if (typeof pkg.main === "string")
                addEntry(path.join(pkgDir, pkg.main));
            if (typeof pkg.bin === "string")
                addEntry(path.join(pkgDir, pkg.bin));
            else if (pkg.bin && typeof pkg.bin === "object")
                for (const v of Object.values(pkg.bin))
                    addEntry(path.join(pkgDir, String(v)));
            if (typeof pkg.exports === "string")
                addEntry(path.join(pkgDir, pkg.exports));
        }
        catch { }
    }
    const commonEntries = ["main.tsx", "main.ts", "main.js", "index.ts", "index.js", "app.ts", "app.js", "server.ts", "server.js", "cli.ts", "cli.js", "bootstrap.ts", "bootstrap.js"];
    for (const f of scanSourceFiles(root, excludes, 3)) {
        const base = path.basename(f);
        if (commonEntries.includes(base))
            addEntry(f);
    }
    const workerEntries = [];
    for (const f of scanSourceFiles(root, excludes, 4)) {
        if (path.basename(f) === "wrangler.toml") {
            try {
                const content = fs.readFileSync(f, "utf8");
                const m = content.match(/^main\s*=\s*["']([^"']+)["']/m);
                if (m)
                    addEntry(path.join(path.dirname(f), m[1]));
            }
            catch { }
        }
    }
    return entryPoints;
}
function identifyModules(root, excludes) {
    const modules = [];
    const seen = new Set();
    function isManifestFile(p) {
        return ["package.json", "Cargo.toml", "go.mod", "pyproject.toml"].some(n => path.basename(p) === n);
    }
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    }
    catch {
        return modules;
    }
    for (const entry of entries) {
        if (!entry.isDirectory() || excludes.includes(entry.name))
            continue;
        const modulePath = path.join(root, entry.name);
        const hasManifest = ["package.json", "Cargo.toml", "go.mod", "pyproject.toml"].some(n => fs.existsSync(path.join(modulePath, n)));
        const hasIndex = fs.existsSync(path.join(modulePath, "index.ts")) || fs.existsSync(path.join(modulePath, "index.js"));
        const nestedDirs = [];
        try {
            for (const sub of fs.readdirSync(modulePath, { withFileTypes: true })) {
                if (sub.isDirectory() && !excludes.includes(sub.name) && ["src", "lib", "app", "pages", "components", "routes", "api", "services"].includes(sub.name)) {
                    nestedDirs.push(sub.name);
                }
            }
        }
        catch { }
        if (hasManifest || hasIndex || nestedDirs.length > 0) {
            if (!seen.has(entry.name)) {
                seen.add(entry.name);
                const keyFiles = scanSourceFiles(modulePath, excludes, 3)
                    .filter(f => /\.(ts|tsx|js|jsx|py|rs|go|rb|java|cs|php)$/.test(f))
                    .slice(0, 8);
                const deps = [];
                const manifest = ["package.json", "Cargo.toml", "go.mod", "pyproject.toml"].map(n => path.join(modulePath, n)).find(p => fs.existsSync(p));
                if (manifest) {
                    try {
                        const content = fs.readFileSync(manifest, "utf8");
                        const depsMatch = content.match(/(?:dependencies|dependencies\s*=|dependencies\s*\()[:=\s\[]([\s\S]{0,600})/);
                        if (depsMatch) {
                            for (const line of depsMatch[1].split("\n")) {
                                const dm = line.match(/["']([@a-z0-9._/-]+)["']\s*[:=]/i);
                                if (dm)
                                    deps.push(dm[1]);
                            }
                        }
                    }
                    catch { }
                }
                modules.push({
                    name: entry.name,
                    dir: modulePath,
                    purpose: inferModulePurpose(entry.name, modulePath),
                    keyFiles,
                    dependencies: deps.slice(0, 10),
                });
            }
        }
    }
    // Treat root-level source dirs (src, lib, workers/...) as modules when no nested manifest exists
    const featureDirs = ["src", "lib", "workers", "app", "pages", "components", "services", "utils", "core", "shared", "api", "server", "client", "web", "mobile", "cli", "bin", "tools", "scripts", "tests", "test", "spec", "docs", "config", "infra", "deploy", "ops", "mcp"];
    for (const featureDir of featureDirs) {
        const featurePath = path.join(root, featureDir);
        if (seen.has(featureDir))
            continue;
        if (fs.existsSync(featurePath) && fs.statSync(featurePath).isDirectory()) {
            seen.add(featureDir);
            modules.push({
                name: featureDir,
                dir: featurePath,
                purpose: inferModulePurpose(featureDir, featurePath),
                keyFiles: scanSourceFiles(featurePath, excludes, 3)
                    .filter(f => /\.(ts|tsx|js|jsx|py|rs|go|rb|java|cs|php)$/.test(f))
                    .slice(0, 6),
                dependencies: [],
            });
        }
    }
    return modules;
}
function inferModulePurpose(dirName, dirPath) {
    const name = dirName.toLowerCase();
    const purposeMap = {
        "src": "Source code", "lib": "Library code", "packages": "Monorepo packages", "apps": "Application entry points",
        "app": "Main application", "components": "UI components", "services": "Business logic services", "utils": "Utility functions",
        "core": "Core functionality", "shared": "Shared code", "common": "Common utilities", "api": "API endpoints and handlers",
        "server": "Server implementation", "client": "Client-side code", "web": "Web frontend", "mobile": "Mobile app code",
        "cli": "Command-line interface", "bin": "Executable binaries", "tools": "Development tools", "scripts": "Build/automation scripts",
        "tests": "Test files", "docs": "Documentation", "config": "Configuration files", "infra": "Infrastructure code",
        "deploy": "Deployment configs", "mcp": "MCP server implementation", "mcp-server": "MCP server implementation",
        "workers": "Background workers / serverless functions", "routes": "Route handlers", "pages": "Page components",
    };
    if (purposeMap[name])
        return purposeMap[name];
    try {
        const readme = path.join(dirPath, "README.md");
        if (fs.existsSync(readme)) {
            const content = fs.readFileSync(readme, "utf8").split("\n").slice(0, 5).join(" ");
            if (content.trim().length > 0)
                return `Module: ${content.trim().substring(0, 80)}`;
        }
    }
    catch { }
    try {
        const pkgPath = path.join(dirPath, "package.json");
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            if (pkg.description)
                return `Module: ${pkg.description}`;
        }
    }
    catch { }
    return `Module in ${dirName}/ directory`;
}
function isTestFile(file) {
    const parts = file.split(path.sep);
    if (parts.some(p => /^(test|tests|__tests__|spec|specs)$/.test(p)))
        return true;
    const base = path.basename(file);
    return /\.test\.[cm]?[jt]sx?$/.test(base) || /\.spec\.[cm]?[jt]sx?$/.test(base);
}
function extractInterfaces(root, excludes, sourceFiles) {
    const seenFiles = new Set();
    const maxPerFile = 8;
    const typeDefs = sourceFiles
        .map(f => {
        if (seenFiles.has(f))
            return null;
        const ext = path.extname(f);
        if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext))
            return null;
        if (f.endsWith(".d.ts"))
            return null;
        if (isTestFile(f))
            return null;
        let content;
        try {
            content = fs.readFileSync(f, "utf8");
        }
        catch {
            return null;
        }
        if (content.length > 200000)
            return null;
        seenFiles.add(f);
        const sigs = [];
        const patterns = [
            { re: /^export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm, hasParams: true },
            { re: /^export\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm, hasParams: true },
            { re: /^export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>/gm, hasParams: false },
            { re: /^export\s+(?:class|interface|type|enum)\s+([A-Za-z0-9_]+)/gm, hasParams: false },
        ];
        for (const { re, hasParams } of patterns) {
            let m;
            while ((m = re.exec(content)) !== null && sigs.length < maxPerFile) {
                if (m.index === re.lastIndex)
                    re.lastIndex++;
                if (hasParams && m[2] !== undefined) {
                    const params = m[2].split(",").map(p => p.trim()).filter(Boolean).slice(0, 4).join(", ");
                    sigs.push(`${m[1]}(${params})`);
                }
                else {
                    sigs.push(m[1]);
                }
            }
        }
        if (sigs.length === 0)
            return null;
        const moduleName = moduleOfPath(root, f);
        return { module: moduleName, file: f, signatures: [...new Set(sigs)].slice(0, maxPerFile) };
    })
        .filter((x) => x !== null);
    // Rank: prefer modules with more unique signatures; group by module, keep top 6 modules
    const byModule = new Map();
    for (const g of typeDefs) {
        const arr = byModule.get(g.module) || [];
        arr.push(g);
        byModule.set(g.module, arr);
    }
    const ranked = [...byModule.entries()].sort((a, b) => b[1].reduce((s, g) => s + g.signatures.length, 0) - a[1].reduce((s, g) => s + g.signatures.length, 0));
    const result = [];
    for (const [, arr] of ranked.slice(0, 6)) {
        result.push(...arr.slice(0, 3));
    }
    return result;
}
function moduleOfPath(root, file) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const parts = rel.split("/");
    if (parts.length >= 2)
        return parts[0];
    return "root";
}
function buildModuleDetail(workspaceRoot, mod) {
    const lines = [`# ${mod.name} — Map Detail`, ``];
    lines.push(`**Purpose**: ${mod.purpose}`);
    lines.push(`**Key files**:`);
    for (const f of mod.keyFiles)
        lines.push(`- \`${rel(workspaceRoot, f)}\``);
    if (mod.dependencies.length > 0) {
        lines.push(`**Dependencies**: ${mod.dependencies.join(", ")}`);
    }
    lines.push(``, `## Public exports`);
    for (const f of mod.keyFiles.slice(0, 5)) {
        const sigs = extractSignaturesForFile(f).slice(0, 8);
        if (sigs.length === 0)
            continue;
        lines.push(`\`{0}\``.replace("{0}", rel(workspaceRoot, f)));
        for (const s of sigs)
            lines.push(`- \`${s}\``);
    }
    lines.push(``, `## Data flow / call chains`, ``, `<!-- explorer: fill in entry point -> core functions -> persistence/IO with file:line refs -->`);
    return lines.join("\n");
}
function extractSignaturesForFile(file) {
    let content;
    try {
        content = fs.readFileSync(file, "utf8");
    }
    catch {
        return [];
    }
    if (content.length > 200000)
        return [];
    const sigs = [];
    const patterns = [
        /^export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm,
        /^export\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm,
        /^export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>/gm,
        /^export\s+(?:class|interface|type|enum)\s+([A-Za-z0-9_]+)/gm,
    ];
    for (const re of patterns) {
        let m;
        while ((m = re.exec(content)) !== null && sigs.length < 12) {
            if (m[2] !== undefined) {
                const params = m[2].split(",").map(p => p.trim()).filter(Boolean).slice(0, 4).join(", ");
                sigs.push(`${m[1]}(${params})`);
            }
            else {
                sigs.push(m[1]);
            }
        }
    }
    return [...new Set(sigs)];
}
function detectLanguage(sourceFiles) {
    const extCount = {};
    for (const f of sourceFiles) {
        const ext = path.extname(f);
        extCount[ext] = (extCount[ext] || 0) + 1;
    }
    const langMap = {
        ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
        ".py": "Python", ".rs": "Rust", ".go": "Go", ".rb": "Ruby", ".java": "Java", ".cs": "C#", ".php": "PHP",
    };
    let best = "Unknown", bestCount = 0;
    for (const [ext, count] of Object.entries(extCount)) {
        const lang = langMap[ext] || "Unknown";
        if (count > bestCount) {
            bestCount = count;
            best = lang;
        }
    }
    return bestCount > 0 ? `${best} (${bestCount} files)` : "Unknown";
}
function detectFramework(root, excludes) {
    const scores = {};
    function add(fw, s) { scores[fw] = (scores[fw] || 0) + s; }
    const pkgFiles = [];
    function findPkgs(dir, depth) {
        if (depth > 4)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (excludes.includes(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                findPkgs(full, depth + 1);
            else if (entry.name === "package.json")
                pkgFiles.push(full);
        }
    }
    findPkgs(root, 0);
    for (const pkgPath of pkgFiles) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            const weight = Math.max(1, 10 - path.relative(root, pkgPath).split(path.sep).length);
            if (deps["next"])
                add("Next.js", weight * 3);
            if (deps["react"])
                add("React", weight * 2);
            if (deps["vue"])
                add("Vue.js", weight * 2);
            if (deps["svelte"])
                add("Svelte", weight * 2);
            if (deps["express"])
                add("Express.js", weight * 2);
            if (deps["fastify"])
                add("Fastify", weight * 2);
            if (deps["nuxt"])
                add("Nuxt.js", weight * 2);
            if (deps["tailwindcss"])
                add("Tailwind CSS", weight);
            if (deps["vite"])
                add("Vite", weight);
            if (deps["@cloudflare/workers-types"])
                add("Cloudflare Workers", weight * 2);
            if (deps["firebase"])
                add("Firebase", weight);
        }
        catch { }
    }
    if (fs.existsSync(path.join(root, "docker-compose.yml")) || fs.existsSync(path.join(root, "docker-compose.yaml")))
        add("Docker", 5);
    if (fs.existsSync(path.join(root, "wrangler.toml")))
        add("Cloudflare Workers", 3);
    let best = "Unknown", bestScore = 0;
    for (const [fw, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            best = fw;
        }
    }
    return bestScore > 0 ? best : "Unknown";
}
function detectBuildSystem(root, excludes) {
    const buildSystems = [];
    const findAny = (names) => {
        function walk(dir, depth) {
            if (depth > 3)
                return false;
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            }
            catch {
                return false;
            }
            for (const entry of entries) {
                if (excludes.includes(entry.name))
                    continue;
                if (entry.isDirectory()) {
                    if (walk(path.join(dir, entry.name), depth + 1))
                        return true;
                }
                else if (names.includes(entry.name))
                    return true;
            }
            return false;
        }
        return walk(root, 0);
    };
    if (findAny(["package.json"]))
        buildSystems.push("npm/yarn/pnpm");
    if (findAny(["Makefile"]))
        buildSystems.push("Make");
    if (findAny(["build.gradle", "build.gradle.kts"]))
        buildSystems.push("Gradle");
    if (findAny(["CMakeLists.txt"]))
        buildSystems.push("CMake");
    if (findAny(["Cargo.toml"]))
        buildSystems.push("Cargo/crates.io");
    if (findAny(["go.mod"]))
        buildSystems.push("Go modules");
    if (findAny(["Dockerfile", "docker-compose.yml", "docker-compose.yaml"]))
        buildSystems.push("Docker");
    if (findAny(["pyproject.toml", "setup.py", "requirements.txt"]))
        buildSystems.push("pip/venv");
    if (findAny(["wrangler.toml", "wrangler.jsonc"]))
        buildSystems.push("Wrangler (Cloudflare)");
    return buildSystems.length > 0 ? buildSystems.join(", ") : "Unknown";
}
function extractConfig(root, excludes) {
    const items = [];
    try {
        const pkgPath = path.join(root, "package.json");
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            if (pkg.scripts) {
                const interesting = Object.entries(pkg.scripts).filter(([k]) => ["build", "dev", "start", "test", "lint", "preview", "worker:dev", "deploy"].some(s => k.includes(s)));
                for (const [name, script] of interesting)
                    items.push(`npm run ${name}: \`${String(script).slice(0, 120)}\``);
            }
        }
    }
    catch { }
    const envFiles = [];
    function findEnv(dir, depth) {
        if (depth > 2)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (excludes.includes(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                findEnv(full, depth + 1);
            else if ([".env.example", ".env", ".dev.vars"].includes(entry.name))
                envFiles.push(full);
        }
    }
    findEnv(root, 0);
    for (const envFile of envFiles.slice(0, 3)) {
        try {
            const content = fs.readFileSync(envFile, "utf8");
            const keys = [];
            for (const line of content.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#"))
                    continue;
                // Only treat as a key if it looks like a valid env var name (no quotes, no colons, no spaces)
                if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed))
                    continue;
                keys.push(trimmed.slice(0, trimmed.indexOf("=")).trim());
            }
            if (keys.length > 0)
                items.push(`Env vars in \`${rel(root, envFile)}\`: ${keys.slice(0, 12).join(", ")}`);
        }
        catch { }
    }
    const ciFiles = [];
    function findCi(dir, depth) {
        if (depth > 2)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (excludes.includes(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                findCi(full, depth + 1);
            else if (["deploy.yml", "ci.yml", "main.yml", "build.yml"].includes(entry.name))
                ciFiles.push(full);
        }
    }
    findCi(root, 0);
    for (const ci of ciFiles.slice(0, 2))
        items.push(`CI: \`${rel(root, ci)}\``);
    return items;
}
export function readFreshness(workspaceRoot) {
    const mapPath = path.join(workspaceRoot, "CODEBASE_MAP.md");
    let lastRegenerated = "unknown";
    let enriched = false;
    let recordedCommit = "unknown";
    try {
        const content = fs.readFileSync(mapPath, "utf8");
        const m = content.match(/Last regenerated: ([^\n]+)/);
        if (m)
            lastRegenerated = m[1].trim();
        enriched = /Enrichment status: (?!PENDING)/.test(content);
        const cm = content.match(/Git commit at last regeneration: ([^\s(]+)/);
        if (cm)
            recordedCommit = cm[1].trim();
    }
    catch { }
    let gitCommit = "unknown";
    let dirty = false;
    try {
        gitCommit = execSync("git rev-parse --short HEAD", { cwd: workspaceRoot, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
        const status = execSync("git status --porcelain", { cwd: workspaceRoot, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
        dirty = status.length > 0;
    }
    catch {
        gitCommit = "not-a-git-repo";
    }
    return { gitCommit, dirty, lastRegenerated, enriched, recordedCommit };
}
/**
 * Returns true when the map's recorded git commit differs from HEAD AND at least
 * one non-map file changed in between, meaning the deterministic sections are
 * stale and should be regenerated. A dirty working tree alone does NOT make the
 * map stale (the map reflects the last committed state plus any uncommitted
 * changes the Explorer has since verified). Commits that only touch
 * CODEBASE_MAP.md (e.g. committing the map itself) do NOT count as stale —
 * without this check, regenerate → commit → regenerate churns forever.
 */
export function isMapStale(workspaceRoot) {
    const f = readFreshness(workspaceRoot);
    if (!f)
        return true;
    if (f.recordedCommit === "unknown" || f.recordedCommit === "not-a-git-repo")
        return true;
    if (f.gitCommit === "unknown" || f.gitCommit === "not-a-git-repo")
        return false;
    if (f.recordedCommit === f.gitCommit)
        return false;
    try {
        const changed = execSync(`git diff --name-only ${f.recordedCommit}..HEAD`, {
            cwd: workspaceRoot,
            stdio: ["pipe", "pipe", "pipe"],
        }).toString().trim();
        return changed
            .split("\n")
            .some(line => {
            const l = line.trim();
            // CODEBASE_MAP.md and .agents/ are map/agent metadata, not code.
            return l.length > 0 && l !== "CODEBASE_MAP.md" && !l.startsWith(".agents/");
        });
    }
    catch {
        return true;
    }
}
/**
 * Extract the Explorer's enrichment note from an existing map so it can be
 * preserved across a deterministic regeneration. Returns null if no note exists.
 */
export function extractEnrichmentNote(workspaceRoot) {
    const mapPath = path.join(workspaceRoot, "CODEBASE_MAP.md");
    try {
        const content = fs.readFileSync(mapPath, "utf8");
        const m = content.match(/Enrichment status: VERIFIED[^\n]*\n(?:[^\n]*\n)*?[^\n]*?(?=Enrichment note:)/);
        const noteMatch = content.match(/Enrichment note: ([^\n]+)/);
        if (noteMatch)
            return noteMatch[1].trim();
        // Fallback: any non-PENDING status line with trailing detail
        const statusMatch = content.match(/Enrichment status: (VERIFIED[^\n]*)/);
        if (statusMatch && statusMatch[1].length > 10)
            return statusMatch[1].trim();
    }
    catch { }
    return null;
}
/**
 * Merge a preserved enrichment note back into a freshly-generated map document.
 * Replaces the "Enrichment status: PENDING" line with VERIFIED + the note.
 */
export function mergeEnrichment(freshDoc, note) {
    if (!note)
        return freshDoc;
    return freshDoc.replace(/- Enrichment status: PENDING[^\n]*/, `- Enrichment status: VERIFIED\n- Enrichment note: ${note}`);
}
const INTERFACES_SECTION_RE = /^## Key Interfaces & APIs\n[\s\S]*?(?=\n## )/m;
/**
 * Extract the existing "Key Interfaces & APIs" section (header through the
 * next top-level section) verbatim, or null when the map has no such section.
 * This section accumulates Explorer-verified signatures, so deterministic
 * regeneration must preserve it instead of rebuilding from regex scans.
 */
export function extractInterfacesSection(content) {
    const m = content.match(INTERFACES_SECTION_RE);
    return m ? m[0] : null;
}
function splitModuleBlocks(section) {
    const out = [];
    const body = section.replace(/^## Key Interfaces & APIs\n/, "");
    for (const part of body.split(/\n### /)) {
        const nl = part.indexOf("\n");
        if (nl === -1)
            continue;
        const mod = part.slice(0, nl).trim();
        const lines = part.slice(nl + 1).split("\n").map(l => l.trim()).filter(l => l.startsWith("- "));
        if (mod)
            out.push({ mod, lines });
    }
    return out;
}
/**
 * Merge a preserved "Key Interfaces & APIs" section into a freshly-generated
 * map document. Per-module union: the deterministic (fresh) signatures stay,
 * and preserved (Explorer-curated) signature lines are appended when not
 * already present — so manual enrichment survives deterministic regeneration
 * while new exports still appear automatically. Modules that only exist in the
 * preserved section are appended. If the fresh doc has no interfaces section
 * (no exports found), the preserved one is inserted before "## Configuration"
 * (or "## Freshness").
 */
export function withInterfacesSection(freshDoc, preserved) {
    const freshMatch = freshDoc.match(INTERFACES_SECTION_RE);
    const preservedModules = splitModuleBlocks(preserved);
    if (!freshMatch) {
        const anchor = freshDoc.includes("## Configuration") ? "## Configuration" : "## Freshness";
        const idx = freshDoc.indexOf(anchor);
        if (idx === -1)
            return freshDoc + "\n" + preserved + "\n";
        return freshDoc.slice(0, idx) + preserved + "\n\n" + freshDoc.slice(idx);
    }
    const freshModules = splitModuleBlocks(freshMatch[0]);
    let merged = "## Key Interfaces & APIs\n";
    const seenMods = new Set();
    for (const { mod, lines } of freshModules) {
        seenMods.add(mod);
        merged += `\n### ${mod}\n\n${lines.join("\n")}\n`;
    }
    for (const { mod, lines } of preservedModules) {
        if (seenMods.has(mod)) {
            const freshLines = freshModules.find(m => m.mod === mod).lines;
            const missing = lines.filter(l => !freshLines.includes(l));
            if (missing.length > 0) {
                const all = [...freshLines, ...missing];
                merged = merged.replace(`\n### ${mod}\n\n${freshLines.join("\n")}\n`, `\n### ${mod}\n\n${all.join("\n")}\n`);
            }
        }
        else {
            seenMods.add(mod);
            merged += `\n### ${mod}\n\n${lines.join("\n")}\n`;
        }
    }
    return freshDoc.replace(INTERFACES_SECTION_RE, merged);
}
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
function prune(doc, { maxTokens, maxChars }) {
    if (estimateTokens(doc) <= maxTokens && doc.length <= maxChars)
        return doc;
    // Compress directory tree first (lowest information density)
    if (estimateTokens(doc) > maxTokens) {
        doc = doc.replace(/(## Directory Structure\n\n```[\s\S]*?```)/, `## Directory Structure\n\n\`\`\`\n(compressed — full tree available via /map or .agents/map_modules/)\n\`\`\``);
    }
    // Then drop module deep-dives beyond the first 3
    if (estimateTokens(doc) > maxTokens) {
        const deepDiveRe = /(### [^\n]+\n\n(?:- [^\n]*\n)+)/g;
        let count = 0;
        doc = doc.replace(deepDiveRe, (match) => {
            count++;
            return count > 3 ? "" : match;
        });
    }
    return doc;
}
export function get_delta_sections(workspaceRoot, changedFiles) {
    const sections = [];
    const seen = new Set();
    const add = (s) => { if (!seen.has(s)) {
        seen.add(s);
        sections.push(s);
    } };
    for (const file of changedFiles) {
        const relative = path.relative(workspaceRoot, file).replace(/\\/g, "/");
        if (/package\.json|tsconfig|docker|wrangler|vite\.config|Makefile|Cargo\.toml|go\.mod|pyproject/.test(relative)) {
            add("## Configuration");
        }
        else {
            const parts = relative.split("/");
            if (parts.length >= 2) {
                add(`### ${parts[0]}`);
            }
        }
        add("## Freshness");
    }
    return sections;
}
