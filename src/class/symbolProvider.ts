/* eslint-disable @typescript-eslint/no-non-null-assertion */
import path from "path";
import ts from "typescript";
import { TransformState } from "./transformState";
import fs from "fs";
import { isPathDescendantOf } from "../util/isPathDescendantOf";
import assert from "assert";

export const moduleResolutionCache = new Map<string, string | false>();

class FileSymbol {
	private fileSymbol: ts.Symbol;
	public readonly debugUUIDs: ts.Symbol;

	public constructor(public state: TransformState, public file: ts.SourceFile) {
		const fileSymbol = this.state.getSymbol(file);
		assert(fileSymbol, "Invalid file symbol");
		this.fileSymbol = fileSymbol;
		this.debugUUIDs = this.get("$debugUUIDs");
	}

	get(name: string) {
		const exportSymbol = this.fileSymbol.exports?.get(name as ts.__String);
		assert(exportSymbol, "No file export by the name " + name);

		return exportSymbol;
	}
}

export class SymbolProvider {
	public moduleFile: FileSymbol | undefined;

	public constructor(private state: TransformState) {
		this.lookupModule();
	}

	public isModule(file: ts.SourceFile): boolean {
		if (!this.envDir) {
			return false;
		}

		if (
			isPathDescendantOf(file.fileName, this.envDir) &&
			!isPathDescendantOf(file.fileName, path.join(this.envDir, "example"))
		) {
			return true;
		} else {
			return false;
		}
	}

	private lookupModule() {
		for (const file of this.state.program.getSourceFiles()) {
			if (this.isModule(file)) {
				this.moduleFile = new FileSymbol(this.state, file);
			}
		}
	}

	private resolveModuleDir(moduleName: string) {
		const modulePath = moduleResolutionCache.get(moduleName);
		if (modulePath !== undefined) return modulePath || undefined;

		const dummyFile = path.join(this.state.srcDir, "dummy.ts");
		const module = ts.resolveModuleName(moduleName, dummyFile, this.state.options, ts.sys);
		const resolvedModule = module.resolvedModule;
		if (resolvedModule) {
			const modulePath = fs.realpathSync(path.join(resolvedModule.resolvedFileName, "../"));
			moduleResolutionCache.set(moduleName, modulePath);
			return modulePath;
		}
		moduleResolutionCache.set(moduleName, false);
	}

	private envDir = this.resolveModuleDir("rbxts-transform-guid");
}
