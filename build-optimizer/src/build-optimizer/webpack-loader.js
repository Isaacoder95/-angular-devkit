"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const source_map_1 = require("source-map");
const loaderUtils = require('loader-utils');
const build_optimizer_1 = require("./build-optimizer");
exports.buildOptimizerLoaderPath = __filename;
const alwaysProcess = (path) => 
// Always process TS files.
path.endsWith('.ts') ||
    path.endsWith('.tsx') ||
    // Always process factory files.
    path.endsWith('.ngfactory.js') ||
    path.endsWith('.ngstyle.js');
function buildOptimizerLoader(content, previousSourceMap) {
    this.cacheable();
    const callback = this.async();
    if (!callback) {
        throw new Error('Async loader support is required.');
    }
    const skipBuildOptimizer = this._module && this._module.factoryMeta && this._module.factoryMeta.skipBuildOptimizer;
    if (!alwaysProcess(this.resourcePath) && skipBuildOptimizer) {
        // Skip loading processing this file with Build Optimizer if we determined in
        // BuildOptimizerWebpackPlugin that we shouldn't.
        // Webpack typings for previousSourceMap are wrong, they are JSON objects and not strings.
        // tslint:disable-next-line:no-any
        this.callback(null, content, previousSourceMap);
        return;
    }
    const options = loaderUtils.getOptions(this) || {};
    // Make up names of the intermediate files so we can chain the sourcemaps.
    const inputFilePath = this.resourcePath + '.pre-build-optimizer.js';
    const outputFilePath = this.resourcePath + '.post-build-optimizer.js';
    const boOutput = build_optimizer_1.buildOptimizer({
        content,
        originalFilePath: this.resourcePath,
        inputFilePath,
        outputFilePath,
        emitSourceMap: options.sourceMap,
        isSideEffectFree: this._module && this._module.factoryMeta && this._module.factoryMeta.sideEffectFree,
    });
    if (boOutput.emitSkipped || boOutput.content === null) {
        // tslint:disable-next-line:no-any
        this.callback(null, content, previousSourceMap);
        return;
    }
    const intermediateSourceMap = boOutput.sourceMap;
    let newContent = boOutput.content;
    let newSourceMap;
    if (options.sourceMap && intermediateSourceMap) {
        // Webpack doesn't need sourceMappingURL since we pass them on explicitely.
        newContent = newContent.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '');
        if (previousSourceMap) {
            // If there's a previous sourcemap, we have to chain them.
            // See https://github.com/mozilla/source-map/issues/216#issuecomment-150839869 for a simple
            // source map chaining example.
            // Use http://sokra.github.io/source-map-visualization/ to validate sourcemaps make sense.
            // Force the previous sourcemap to use the filename we made up for it.
            // In order for source maps to be chained, the consumed source map `file` needs to be in the
            // consumers source map `sources` array.
            previousSourceMap.file = inputFilePath;
            // Chain the sourcemaps.
            source_map_1.SourceMapConsumer.with(intermediateSourceMap, null, intermediate => {
                return source_map_1.SourceMapConsumer.with(previousSourceMap, null, previous => {
                    const generator = source_map_1.SourceMapGenerator.fromSourceMap(intermediate);
                    generator.applySourceMap(previous);
                    return generator.toJSON();
                });
                // tslint:disable-next-line: no-any
            }).then(map => callback(null, newContent, map), error => callback(error));
            return;
        }
        else {
            // Otherwise just return our generated sourcemap.
            newSourceMap = intermediateSourceMap;
        }
    }
    // Webpack typings for previousSourceMap are wrong, they are JSON objects and not strings.
    // tslint:disable-next-line:no-any
    callback(null, newContent, newSourceMap);
}
exports.default = buildOptimizerLoader;
