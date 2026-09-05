# Illustrator Artboard Compiler

A JSX utility for Adobe Illustrator that combines artboards from multiple Illustrator files into one editable master document.

It keeps the original artboard sizes, preserves artwork positioning relative to each artboard, and organizes imported artwork by source file and artboard.

## What it does

- Select multiple `.ai` files
- Reorder the source files before compiling
- Read all source artboards and their exact dimensions
- Create one master Illustrator document
- Preserve each artboard's original size
- Keep artwork editable
- Preserve artwork position relative to its source artboard
- Create one parent layer per imported Illustrator file
- Create one sublayer per artboard
- Keep each sublayer the same layer color as its parent file layer
- Warn when source files use mixed RGB and CMYK document color modes
- Respect Illustrator's 100-artboard document limit

## Requirements

- Adobe Illustrator
- Illustrator ExtendScript / JSX support
- Source files in Adobe Illustrator `.ai` format

## Installation

1. Download `AUK_Illustrator_Artboard_Compiler.jsx` from the `src` folder.
2. In Illustrator, go to **File > Scripts > Other Script...**
3. Select the JSX file.

You can also place the JSX file in Illustrator's Scripts folder if you want it to appear permanently under **File > Scripts**.

## Usage

1. Run the script from Illustrator.
2. Select the Illustrator files you want to combine.
3. Set their order in the file-order window.
4. Click **Compile**.
5. Review the generated master document.
6. Save the new master Illustrator file.

The script does not overwrite the source files.

## Layer structure

Each imported Illustrator file becomes one parent layer, with one sublayer for each artboard:

```text
Source_File_01
  Artboard 01 - ...
  Artboard 02 - ...

Source_File_02
  Artboard 01 - ...
  Artboard 02 - ...

Source_File_03
  Artboard 01 - ...
  Artboard 02 - ...
```

Each artboard sublayer uses the same Illustrator layer color as its parent source-file layer.

## Color mode

A single Illustrator document can use only one document color mode.

The master document uses the color mode of the first selected source file. If the selected files contain a mix of RGB and CMYK documents, the script warns before continuing.

## Current release

**v2.3.0**

This is the first public stable release.

## Notes

This tool was built for production workflows involving Illustrator files with many artboards. It is intended to reduce the manual work of moving artboards and artwork into a single editable document.

## Author

Asad Ullah Khan  
AUK Systems
