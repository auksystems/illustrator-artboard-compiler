#target illustrator

/*
AUK Illustrator Artboard Compiler v2.3

Stable architecture:
- Scans source AI files first.
- Creates ALL master artboards in one Illustrator-native grid operation.
- Resizes each master artboard to the exact source artboard size.
- Never keeps Artboard object references across document switches.
- Never uses clipboard copy/paste.
- Duplicates native Illustrator objects directly.
- Preserves each object's position relative to its source artboard.
- Uses the first source file's document color space.
*/

(function () {
    var SCRIPT_NAME = "AUK Illustrator Artboard Compiler";
    var GAP_PT = 36; // 0.5 inch between artboard cells

    function fail(msg) {
        alert(msg, SCRIPT_NAME);
        throw new Error(msg);
    }

    function copyRect(r) {
        return [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3])];
    }

    function rectWidth(r) {
        return Math.abs(Number(r[2]) - Number(r[0]));
    }

    function rectHeight(r) {
        return Math.abs(Number(r[1]) - Number(r[3]));
    }

    function baseName(fileName) {
        return String(fileName).replace(/\.[^\.]+$/, "");
    }

    function safeLayerName(s) {
        s = String(s);
        s = s.replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
        if (s.length > 80) s = s.substring(0, 80);
        return s;
    }

    function collectFiles() {
        var files = File.openDialog(
            "Select Illustrator files to compile",
            "Adobe Illustrator Files:*.ai",
            true
        );

        if (!files || files.length === 0) return null;

        files.sort(function (a, b) {
            var aa = String(a.name).toLowerCase();
            var bb = String(b.name).toLowerCase();
            if (aa < bb) return -1;
            if (aa > bb) return 1;
            return 0;
        });

        return files;
    }

    function orderDialog(files) {
        var dlg = new Window("dialog", SCRIPT_NAME);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];

        dlg.add("statictext", undefined, "Set the source file order:");

        var list = dlg.add("listbox", undefined, [], {multiselect:false});
        list.preferredSize = [580, 190];

        var i;
        for (i = 0; i < files.length; i++) {
            list.add("item", files[i].name);
        }
        if (list.items.length > 0) list.selection = 0;

        var moveRow = dlg.add("group");
        moveRow.alignment = "center";

        var upBtn = moveRow.add("button", undefined, "Move Up");
        var downBtn = moveRow.add("button", undefined, "Move Down");

        function swap(a, b) {
            var f = files[a];
            files[a] = files[b];
            files[b] = f;

            var t = list.items[a].text;
            list.items[a].text = list.items[b].text;
            list.items[b].text = t;

            list.selection = b;
        }

        upBtn.onClick = function () {
            if (!list.selection) return;
            var n = list.selection.index;
            if (n > 0) swap(n, n - 1);
        };

        downBtn.onClick = function () {
            if (!list.selection) return;
            var n = list.selection.index;
            if (n < list.items.length - 1) swap(n, n + 1);
        };

        var note = dlg.add(
            "statictext",
            undefined,
            "The master AI will keep this exact artboard order."
        );

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        buttons.add("button", undefined, "Cancel", {name:"cancel"});
        buttons.add("button", undefined, "Compile", {name:"ok"});

        if (dlg.show() !== 1) return null;
        return files;
    }

    function getColorSpaceName(cs) {
        try {
            if (cs == DocumentColorSpace.RGB) return "RGB";
            if (cs == DocumentColorSpace.CMYK) return "CMYK";
        } catch (e) {}
        return "Unknown";
    }

    function scanSources(files) {
        var result = {
            total: 0,
            maxWidth: 0,
            maxHeight: 0,
            colorSpace: null,
            colorSpaceName: "",
            mixedColorSpaces: false,
            sources: []
        };

        var fi, ai, doc, r, w, h, csName;

        for (fi = 0; fi < files.length; fi++) {
            doc = app.open(files[fi]);

            if (fi === 0) {
                result.colorSpace = doc.documentColorSpace;
                result.colorSpaceName = getColorSpaceName(doc.documentColorSpace);
            } else {
                csName = getColorSpaceName(doc.documentColorSpace);
                if (csName !== result.colorSpaceName) {
                    result.mixedColorSpaces = true;
                }
            }

            var sourceInfo = {
                file: files[fi],
                artboards: []
            };

            for (ai = 0; ai < doc.artboards.length; ai++) {
                r = copyRect(doc.artboards[ai].artboardRect);
                w = rectWidth(r);
                h = rectHeight(r);

                if (!(w > 0) || !(h > 0)) {
                    doc.close(SaveOptions.DONOTSAVECHANGES);
                    fail(
                        "Invalid artboard size found in:\n" +
                        files[fi].fsName +
                        "\nArtboard " + (ai + 1)
                    );
                }

                sourceInfo.artboards.push({
                    sourceRect: r,
                    width: w,
                    height: h,
                    name: String(doc.artboards[ai].name)
                });

                if (w > result.maxWidth) result.maxWidth = w;
                if (h > result.maxHeight) result.maxHeight = h;
                result.total++;
            }

            result.sources.push(sourceInfo);
            doc.close(SaveOptions.DONOTSAVECHANGES);
        }

        return result;
    }

    function chooseColumns(total, maxW, maxH) {
        var aspect = maxW / maxH;
        if (!(aspect > 0)) aspect = 1;

        var cols = Math.ceil(Math.sqrt(total / aspect));

        if (cols < 1) cols = 1;
        if (cols > total) cols = total;

        return cols;
    }

    function createMaster(scan) {
        var cols = chooseColumns(scan.total, scan.maxWidth, scan.maxHeight);

        var master;

        try {
            master = app.documents.add(
                scan.colorSpace,
                scan.maxWidth,
                scan.maxHeight,
                scan.total,
                DocumentArtboardLayout.GridByRow,
                GAP_PT,
                cols
            );
        } catch (e) {
            fail(
                "Illustrator could not create the master artboard grid.\n\n" +
                "Artboards: " + scan.total + "\n" +
                "Largest size: " +
                scan.maxWidth.toFixed(2) + " x " +
                scan.maxHeight.toFixed(2) + " pt\n\n" +
                "Illustrator message:\n" + e
            );
        }

        return master;
    }

    function resizeMasterArtboards(master, scan) {
        var globalIndex = 0;
        var fi, ai, meta, oldR, cx, cy, newR;

        master.activate();

        for (fi = 0; fi < scan.sources.length; fi++) {
            for (ai = 0; ai < scan.sources[fi].artboards.length; ai++) {
                meta = scan.sources[fi].artboards[ai];

                oldR = copyRect(master.artboards[globalIndex].artboardRect);
                cx = (oldR[0] + oldR[2]) / 2;
                cy = (oldR[1] + oldR[3]) / 2;

                // Keep Illustrator's safe grid center and only resize inside that cell.
                newR = [
                    cx - (meta.width / 2),
                    cy + (meta.height / 2),
                    cx + (meta.width / 2),
                    cy - (meta.height / 2)
                ];

                try {
                    master.artboards[globalIndex].artboardRect = newR;
                    master.artboards[globalIndex].name =
                        safeLayerName(
                            baseName(scan.sources[fi].file.name) +
                            " - " + meta.name
                        );
                } catch (e) {
                    fail(
                        "Could not resize master artboard " +
                        (globalIndex + 1) + ".\n\n" +
                        "Target size: " +
                        meta.width.toFixed(2) + " x " +
                        meta.height.toFixed(2) + " pt\n\n" + e
                    );
                }

                // Store a plain coordinate array. Never store an Artboard object.
                meta.destRect = copyRect(
                    master.artboards[globalIndex].artboardRect
                );

                globalIndex++;
            }
        }
    }

    function unlockVisibleArtwork(doc) {
        var i;

        // We do not save source documents, so temporary unlocks are safe.
        try {
            for (i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].visible) {
                    try { doc.layers[i].locked = false; } catch (e1) {}
                }
            }
        } catch (e2) {}

        try {
            for (i = 0; i < doc.pageItems.length; i++) {
                if (!doc.pageItems[i].hidden) {
                    try { doc.pageItems[i].locked = false; } catch (e3) {}
                }
            }
        } catch (e4) {}
    }

    function selectionToArray(selection) {
        var arr = [];
        var i;

        if (!selection) return arr;

        for (i = 0; i < selection.length; i++) {
            arr.push(selection[i]);
        }

        // Try to preserve stacking order as closely as possible.
        arr.sort(function (a, b) {
            var za = 0;
            var zb = 0;
            try { za = a.zOrderPosition; } catch (e1) {}
            try { zb = b.zOrderPosition; } catch (e2) {}
            return za - zb;
        });

        return arr;
    }

    function duplicateArtboard(
        sourceDoc,
        sourceIndex,
        sourceRect,
        master,
        destRect,
        destinationLayer
    ) {
        sourceDoc.activate();

        unlockVisibleArtwork(sourceDoc);

        sourceDoc.selection = null;
        sourceDoc.artboards.setActiveArtboardIndex(sourceIndex);

        try {
            sourceDoc.selectObjectsOnActiveArtboard();
        } catch (e) {
            fail(
                "Could not select artwork on source artboard " +
                (sourceIndex + 1) + ".\n\n" + e
            );
        }

        var items = selectionToArray(sourceDoc.selection);
        if (items.length === 0) {
            sourceDoc.selection = null;
            return;
        }

        var i, item, srcGB, relLeft, relTop, dup, dstGB;
        var targetLeft, targetTop, moveX, moveY;

        /*
        IMPORTANT:
        Do NOT assume absolute Illustrator coordinates survive duplication
        between documents.

        For every selected object we capture its position relative to the
        SOURCE artboard. After duplication, we measure the duplicate's real
        destination bounds and move it to the same relative position inside
        the DESTINATION artboard.
        */
        for (i = 0; i < items.length; i++) {
            item = items[i];

            try {
                srcGB = copyRect(item.geometricBounds);
            } catch (e1) {
                fail(
                    "Could not read the bounds of an object.\n\n" +
                    "Source file:\n" + sourceDoc.fullName.fsName +
                    "\nArtboard: " + (sourceIndex + 1) +
                    "\nObject: " + (i + 1) + " of " + items.length +
                    "\n\n" + e1
                );
            }

            // Distance from source artboard left/top to object left/top.
            relLeft = Number(srcGB[0]) - Number(sourceRect[0]);
            relTop  = Number(sourceRect[1]) - Number(srcGB[1]);

            try {
                dup = item.duplicate(
                    destinationLayer,
                    ElementPlacement.PLACEATBEGINNING
                );
            } catch (e2) {
                fail(
                    "Native duplication failed.\n\n" +
                    "Source file:\n" + sourceDoc.fullName.fsName +
                    "\nArtboard: " + (sourceIndex + 1) +
                    "\nObject: " + (i + 1) + " of " + items.length +
                    "\n\nIllustrator message:\n" + e2
                );
            }

            try {
                dstGB = copyRect(dup.geometricBounds);

                targetLeft = Number(destRect[0]) + relLeft;
                targetTop  = Number(destRect[1]) - relTop;

                moveX = targetLeft - Number(dstGB[0]);
                moveY = targetTop  - Number(dstGB[1]);

                dup.translate(moveX, moveY);
            } catch (e3) {
                fail(
                    "Object duplicated, but exact positioning failed.\n\n" +
                    "Source file:\n" + sourceDoc.fullName.fsName +
                    "\nArtboard: " + (sourceIndex + 1) +
                    "\nObject: " + (i + 1) + " of " + items.length +
                    "\n\nIllustrator message:\n" + e3
                );
            }
        }

        sourceDoc.selection = null;
        master.selection = null;
    }

    function makeFileParentLayer(master, fileName) {
        master.activate();

        var layer = master.layers.add();
        layer.name = safeLayerName(baseName(fileName));

        return layer;
    }

    function cloneLayerColor(layerColor) {
        var c = new RGBColor();

        try { c.red = layerColor.red; } catch (e1) { c.red = 0; }
        try { c.green = layerColor.green; } catch (e2) { c.green = 0; }
        try { c.blue = layerColor.blue; } catch (e3) { c.blue = 0; }

        return c;
    }

    function makeArtboardSubLayer(
        parentLayer,
        artboardNumber,
        artboardName
    ) {
        var sub = parentLayer.layers.add();

        var num = ("00" + artboardNumber).slice(-2);

        sub.name = safeLayerName(
            "Artboard " + num +
            (artboardName ? " - " + artboardName : "")
        );

        // Keep every sublayer under one imported AI file on the exact
        // same layer color as its parent layer.
        try {
            sub.color = cloneLayerColor(parentLayer.color);
        } catch (e) {}

        return sub;
    }

    function runCompile(files, scan, master) {
        var progress = new Window("palette", SCRIPT_NAME);
        progress.orientation = "column";
        progress.alignChildren = ["fill", "top"];

        var status = progress.add("statictext", undefined, "Preparing...");
        status.preferredSize.width = 560;

        var bar = progress.add("progressbar", undefined, 0, scan.total);
        bar.preferredSize = [560, 18];

        progress.show();

        var globalIndex = 0;
        var fi, ai, sourceDoc, meta;
        var parentLayer, artboardLayer;

        for (fi = 0; fi < scan.sources.length; fi++) {
            sourceDoc = app.open(scan.sources[fi].file);

            // One top-level layer for the whole AI source file.
            parentLayer = makeFileParentLayer(
                master,
                scan.sources[fi].file.name
            );

            for (ai = 0; ai < scan.sources[fi].artboards.length; ai++) {
                meta = scan.sources[fi].artboards[ai];

                status.text =
                    "File " + (fi + 1) + "/" + scan.sources.length +
                    " - " + scan.sources[fi].file.name +
                    " - Artboard " + (ai + 1) + "/" +
                    scan.sources[fi].artboards.length;

                progress.update();

                // One sublayer for each artboard inside the file layer.
                artboardLayer = makeArtboardSubLayer(
                    parentLayer,
                    ai + 1,
                    meta.name
                );

                duplicateArtboard(
                    sourceDoc,
                    ai,
                    meta.sourceRect,
                    master,
                    meta.destRect,
                    artboardLayer
                );

                globalIndex++;
                bar.value = globalIndex;
                progress.update();
            }

            sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
        }

        try { progress.close(); } catch (e) {}

        master.activate();

        try {
            master.artboards.setActiveArtboardIndex(0);
            app.executeMenuCommand("fitall");
        } catch (e2) {}
    }

    var files = collectFiles();
    if (!files) return;

    files = orderDialog(files);
    if (!files) return;

    var scan = scanSources(files);

    if (scan.total < 1) {
        fail("No artboards were found.");
    }

    if (scan.total > 100) {
        fail(
            "Illustrator allows a maximum of 100 artboards in one document.\n\n" +
            "Your selected files contain " + scan.total + " artboards."
        );
    }

    if (scan.mixedColorSpaces) {
        var mixedOK = confirm(
            "The selected Illustrator files use mixed RGB/CMYK document color modes.\n\n" +
            "One Illustrator document can only have one document color mode.\n" +
            "The master will use " + scan.colorSpaceName +
            ", matching the FIRST source file.\n\n" +
            "Artwork from files in the other mode may be color-converted by Illustrator.\n\n" +
            "Continue?"
        );

        if (!mixedOK) return;
    }

    var master = createMaster(scan);

    resizeMasterArtboards(master, scan);
    runCompile(files, scan, master);

    alert(
        "Compilation complete.\n\n" +
        files.length + " Illustrator file(s)\n" +
        scan.total + " artboard(s)\n" +
        "Master color mode: " + scan.colorSpaceName + "\n\n" +
        "All master artboards were created before artwork transfer.\n" +
        "No clipboard paste was used.\n" +
        "No Artboard object references were carried between documents.\n" +
        "Artwork was positioned by source-artboard-relative coordinates.\n" +
        "Layer structure: one parent layer per AI file, one sublayer per artboard.\n" +
        "Each artboard sublayer uses the same layer color as its parent AI file.\n\n" +
        "Check the result, then save the master AI.",
        SCRIPT_NAME
    );

})();
