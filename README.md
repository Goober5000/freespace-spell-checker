# FreeSpace Spell Checker

A specialized spell checker for FreeSpace mission and table files that uses the Typo.js library to check spelling within XSTR() strings.

## Repository Structure

This repository includes:

- `index.html` - The main spell checker application
- `Typo.js/` - Hybrid-optimized Typo.js library (git submodule with custom optimization)
- `dictionaries/` - Dictionary files for 12 languages
- `README.md` - This documentation
- `download-dictionaries.sh` - Script to download/update dictionary files
- `DICTIONARY_DOWNLOAD.md` - Manual download instructions for dictionaries

## Quick Start

**For end users:** Just download `index.html` and the dictionary files for your language(s) from the [LibreOffice dictionaries repository](https://github.com/LibreOffice/dictionaries), then open `index.html` and upload your dictionaries.

**For developers:** Clone this repository with submodules:
```bash
git clone --recurse-submodules [repository-url]
```

## Features

- ✅ **Multi-language support** - includes 12 dictionaries: English (US, UK, Canada, Australia, South Africa), German, Spanish, French, Italian, Portuguese (Brazil), Polish, Russian, plus custom dictionary option
- ✅ Extracts and spell-checks text from XSTR() formatted strings
- ✅ **Smart proper noun protection** - capitalized words and ALL CAPS acronyms are NOT auto-corrected
- ✅ **Ship qualifier detection** - recognizes ship prefixes like GTF, NTD, SFr when followed by ship names
- ✅ **FreeSpace organization whitelist** - recognizes GTA, PVN, PVE, HOL, HoL, GTVA, GVTA, NTF, NTB, IFF, GTI, SOC, ISF
- ✅ **FreeSpace-specific words** - recognizes "martialed", "wingmen", "nav", "comm", "comms" as correct
- ✅ **FreeSpace species capitalization** - auto-corrects Terran/Terrans, Vasudan/Vasudans, Shivan/Shivans, Ancients
- ✅ **Proper noun grouping** - each unique proper noun is reported only once, even if it appears multiple times
- ✅ **Zodiac sign correction** - always fixes misspelled zodiac signs (Sagittarius, Scorpio, etc.) regardless of capitalization
- ✅ **Contraction handling** - properly handles "we've", "you've", "they're" without breaking them apart
- ✅ Preserves FreeSpace variables (words starting with $)
- ✅ **Special token round-tripping** - `$quote`, `$semicolon`, `$slash` are transparently converted to their characters for processing, then restored afterwards
- ✅ **Common mistake corrections** - automatically fixes "alright" → "all right", "infact" → "in fact", "enroute" → "en route", "turrent" → "turret"
- ✅ **Automatic spacing corrections** - removes extra spaces, fixes spacing around punctuation
- ✅ **Two-space-after-sentence option** - for writers who prefer double spacing after sentences
- ✅ Auto-corrects lowercase spelling errors
- ✅ Detects grammar issues (its/it's, your/you're, there/their/they're - all bidirectional) for manual review
- ✅ Batch processing of multiple mission files
- ✅ **Visual highlighting** - changed words and grammar issues are highlighted in the report
  - **Corrections section**: Yellow highlights on green text for easy visibility
  - **Grammar issues section**: Light blue highlights on orange text for all issues (confusions, proper nouns, punctuation spacing)
- ✅ **Full string display** - complete strings are shown without truncation for easy review
- ✅ **Flexible filename options** - save with original names or with "_corrected" suffix
- ✅ Detailed correction reports with before/after comparison
- ✅ **Exhaustive display option** - toggle between truncated view (default) and showing all corrections/issues
- ✅ **Selective correction revert** - each correction has a checkbox; uncheck to exclude it from the downloaded output (all-or-nothing per XSTR string)

## Dictionary Support and Limitations

**Supported Languages:**
- English (5 variants): US, UK, Canada, Australia, South Africa  
- German, Spanish, French, Portuguese (Brazil), Polish, Russian
- Italian (full dictionary supported via hybrid optimization)

**Hybrid Dictionary Optimization:**

This tool uses an optimized version of Typo.js that employs a hybrid eager/lazy evaluation strategy. This allows large dictionaries with complex affix rules (like Italian, Russian, Polish) to work efficiently in browsers without memory issues.

**How it works:**
- Simple affix rules (80% of lookups) are expanded immediately for instant performance
- Complex affix rules (20% of lookups) are expanded on-demand and cached
- Result: 90%+ memory savings for large dictionaries while maintaining fast lookups

**Italian Dictionary:** The full Italian dictionary (95,381 words with 3,412 affix rules) is fully supported. Thanks to the hybrid optimization:
- Memory usage: ~75MB (vs 800MB+ with naive expansion)
- Load time: 3-5 seconds
- Lookup performance: Instant for common words, 1-3ms first lookup for rare words (then cached)

If you encounter "out of memory" errors with other very large dictionaries, you can create reduced versions using the included `create-lite-dictionaries.sh` script.

## Setup

### Using the Deployed Version (Recommended)

1. Visit [https://goober5000.github.io/freespace-spell-checker/](https://goober5000.github.io/freespace-spell-checker/)

2. Select your language from the dropdown menu

3. The dictionary will automatically load - you'll see a green success message

4. You're ready to process mission files!

**Available Languages:**
- English: US, UK, Canada, Australia, South Africa
- Other Languages: German, Spanish, French, Italian, Portuguese (Brazil), Polish, Russian
- Custom: Upload any Hunspell-format dictionary for other languages

### Using a Custom Dictionary

If you need a language that's not in the dropdown:

1. Visit the tool and select "Custom/Other Language" from the dropdown

2. Download your dictionary files from the [LibreOffice dictionaries repository](https://github.com/LibreOffice/dictionaries)

3. Upload both the `.aff` and `.dic` files using the file upload buttons

4. The dictionary will load and you can start processing files

### Local Development

For developers working on this tool locally:

1. Clone or download this repository with the dictionary files in the `dictionaries/` folder:
   ```
   repository-root/
   ├── index.html
   ├── Typo.js/          (submodule)
   │   └── typo/
   │       └── typo.js
   └── dictionaries/
       ├── en_US/
       │   ├── en_US.aff
       │   └── en_US.dic
       ├── en_GB/
       │   ├── en_GB.aff
       │   └── en_GB.dic
       └── [other languages]/
   ```

2. Start a local web server in the repository root:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Or using Node.js
   npx serve
   ```

3. Open your browser to `http://localhost:8000/`

4. Select your language from the dropdown - the dictionary will auto-load

## Usage

1. Select your language - the dictionary will load automatically (or upload custom dictionary files if using a non-standard language)
2. Once the dictionary is loaded, drag and drop your files (.fs2 mission files, .tbl/.tbm table files), or click "Select Files"
3. Click "Process Files" to begin spell checking
4. Review the results:
   - **Corrections Applied**: Shows what was automatically fixed
     - Changed words are highlighted with yellow on green text
     - Each correction has a checkbox — uncheck to revert that XSTR string back to its original text in the download. Reverted items dim and show a "Reverted" badge. Corrections hidden behind "...and N more" are included by default; enable "Show all items" to review them.
   - **Grammar Issues**: Lists potential problems for manual review
     - All issues highlighted with light blue on orange text (word confusions, proper nouns, punctuation spacing)
   - **Full strings**: Complete text is displayed without truncation
   - **Display Options**: 
     - "Show all items in lists" - Check to see every correction and grammar issue (default shows first 15 corrections, first 20 grammar issues per file)
     - "Save with original filenames" - Check to download files with their original names instead of adding "_corrected" suffix
     - "Use two spaces after sentences" - Check to use double spacing after sentence-ending punctuation (default is single space)
5. Download corrected files individually or all at once

## Technical Details

### Word Tokenization

The spell checker uses regex-based tokenization instead of word boundaries for accurate parsing:
- **Pattern**: `/\$?\w+('\w+)?/g`
- **Handles**: FreeSpace variables (`$f`, `$variable`), contractions (`we've`, `you've`), standard words, numbers
- **Skips**: Numeric tokens (pure numbers like `1400`, `128`) are not spell-checked
- **Advantage**: $ variables and contractions are parsed as single tokens, eliminating parsing ambiguities
- **No word boundaries (`\b`)**: The code avoids `\b` entirely to prevent tokenization issues

### How It Works

### XSTR String Extraction

The tool specifically looks for strings in the XSTR format:
```
XSTR("text content here", -1)
XSTR ( "more text" , 123 )  // handles optional whitespace
```

Only text within these XSTR strings is spell-checked. The file structure is preserved exactly. Mission title processing is conditional — it only applies when a mission title pattern is found in the file, so table files (.tbl/.tbm) are handled naturally without any special casing.

### Correction Rules

1. **Spell Checking**: Uses the full Typo.js dictionary to detect and correct misspellings
2. **Proper Noun Protection**: 
   - **Capitalized words are NOT auto-corrected** (e.g., "Acronox", "Aken", "Actium", "Macross")
   - **ALL CAPS words are NOT auto-corrected** (e.g., "GTD", "GTCv", "NTF" - treated as acronyms)
   - These are flagged in the grammar report as "Unrecognized capitalized word (possibly a proper noun)"
   - Only lowercase words are auto-corrected (e.g., "recieve" → "receive")
   - This prevents false positives from mission-specific ship names, character names, and locations
3. **FreeSpace Organization Whitelist**:
   - Common FreeSpace organizations are recognized and never flagged as errors
   - Whitelisted: **GTA, PVN, PVE, HOL, HoL, GTVA, GVTA, NTF, NTB, IFF, GTI, SOC, ISF**
   - These acronyms won't appear in the "Unrecognized capitalized word" list
4. **FreeSpace-Specific Words**:
   - Words unique to FreeSpace that aren't in standard dictionaries are recognized
   - Includes: **martialed** (as in "court-martialed"), **wingmen** (plural of wingman), **nav** (navigation), **comm/comms** (communications)
   - These words won't be flagged as misspellings
5. **FreeSpace Species Capitalization**:
   - Species names are always capitalized correctly (singular and plural forms)
   - **Terran/Terrans**, **Vasudan/Vasudans**, **Shivan/Shivans**, **Ancients** (plural only)
   - Examples: "terran" → "Terran", "vasudans" → "Vasudans", "ancients" → "Ancients"
   - Note: "Ancient" (singular) is not auto-corrected since "ancient" is a common English adjective
6. **Ship Qualifier Detection**:
   - Ship prefixes (3-4 letters, mostly uppercase) are automatically recognized when followed by proper nouns
   - Examples: **GTF** Ulysses, **GTD** Philadelphia, **NTD** Repulse, **SFr** Moloch, **GTCv** Jamestown
   - Pattern: First 2-3 letters must be uppercase, last letter can be uppercase or lowercase
   - **Must be followed by a capitalized word** (the ship name) to be recognized
   - FreeSpace $ variables are properly skipped when looking for the following ship name
   - Recognized qualifiers won't be spell-checked, auto-corrected, or flagged as errors
6. **Zodiac Sign Exception**:
   - Zodiac signs are ALWAYS corrected regardless of capitalization
   - Examples: "Saggitarius" → "Sagittarius", "scorpius" → "Scorpio", "aquarias" → "Aquarius"
   - Common misspellings of all 12 zodiac signs are recognized
7. **Contraction Handling**:
   - Contractions are properly recognized (e.g., "we've", "you've", "they're")
   - The parts after apostrophes are NOT spell-checked separately
8. **Custom Rules**:
   - "alright" → "all right" (always corrected regardless of capitalization)
   - "infact" → "in fact" (always corrected regardless of capitalization)
   - "enroute" → "en route" (always corrected regardless of capitalization)
   - "turrent" → "turret" (always corrected regardless of capitalization)
   - Words starting with $ are never changed (FreeSpace variables)
9. **Special Token Round-Tripping**:
   - FreeSpace uses special tokens in place of characters that have meaning in the file format
   - Known tokens: `$quote` ("), `$semicolon` (;), `$slash` (/)
   - These tokens are NOT guaranteed to be at word boundaries (e.g. `$quoteNeo-Terran Front$quote`, `23$slash01$slash2366`)
   - Before processing: tokens are replaced with Unicode Private Use Area placeholder characters, which act as clean word boundaries for the tokenizer
   - After processing: placeholders are restored back to their original tokens
   - This ensures highest-fidelity spell/grammar checking without corrupting the file format
   - The token list is defined in `freespaceTokens` and can be extended with additional tokens as needed
10. **Spacing Corrections** (auto-corrected):
   - Multiple consecutive spaces are consolidated to single spaces
   - Spaces before punctuation are removed
   - Missing spaces after punctuation are added
   - **Two-space option**: When enabled, ensures two spaces after sentence-ending punctuation (periods, question marks, exclamation points) while consolidating 3+ spaces to single space
   - **Abbreviation handling**: Periods after abbreviations (Mr., Dr., Lt., Cmdr., Adm., St., etc.) are not treated as sentence endings
11. **Title Case**: Mission titles are converted to proper title case (small words like "and", "of" stay lowercase)

### Grammar Detection (Not Auto-Fixed)

The tool detects but doesn't fix:
- **Bidirectional its/it's confusion**
  - "its" followed by verbs (is, was, been) → might need "it's" 
  - "it's" followed by possessive contexts (own, place, way) → might need "its"
- **Bidirectional your/you're confusion**
  - "your" followed by verbs/states (going, being, right) → might need "you're"
  - "you're" followed by possessive contexts (ship, orders, mission) → might need "your"
- **Three-way there/their/they're confusion**
  - "there" followed by possessive contexts (ship, fleet) → might need "their"
  - "their" followed by verbs (going, coming, attacking) → might need "they're"
  - "they're" followed by possessive contexts (ship, fleet) → might need "their"
- **Unrecognized capitalized words** (likely proper nouns)
  - Each unique proper noun is listed only once, even if it appears multiple times in the file
  - Example: If "Actium" appears 20 times, you'll see one grammar issue for "Actium", not 20

Review these manually as they may be intentional.

## Browser Compatibility

Works in **Chromium-based browsers**:
- Google Chrome
- Microsoft Edge
- Brave Browser
- Opera

Does not work in Firefox due to differences in file loading APIs.

## Technical Details

- **Language**: JavaScript (runs entirely in browser)
- **Dependencies**: Typo.js spell checking library
- **Dictionary**: Hunspell-style dictionaries (en_US included with Typo.js)
- **File Handling**: Processes files client-side, no data sent to servers

## Troubleshooting

**Dictionary fails to load:**
- Make sure you're using a supported browser (Chrome or Brave)
- Check that you have an internet connection (dictionaries load from GitHub Pages)
- If using a custom language, verify the files are in Hunspell format (.aff and .dic)
- Check browser console (F12) for error messages

**Custom dictionary files not loading:**
- Make sure you downloaded the files as "Raw" from GitHub (not the GitHub HTML page)
- Verify the files are actually .aff and .dic (not .txt or .html)
- Check that the files aren't empty

**No corrections being made:**
- Verify the dictionary loaded successfully (green checkmark message)
- Check browser console (F12) for error messages
- Ensure files contain XSTR() formatted strings

**Running locally:**
- If developing locally, you need to run a web server for dictionaries to load
- Use: `python -m http.server 8000` or `npx serve`
- Open `http://localhost:8000/` (not file:// URLs)

## FAQ

**Q: How do I see all corrections instead of just the first few?**

A: Check the box labeled "Show all corrections and issues (no truncation)" in the results summary. By default, the tool shows the first 15 corrections and first 20 grammar issues per file to keep the report manageable. When checked, it will display every single correction and issue exhaustively.

**Q: Why aren't GTA, GTVA, NTF, and other organizations being flagged?**

A: The spell checker has a built-in whitelist for common FreeSpace organizations: **GTA, PVN, PVE, HOL, HoL, GTVA, GVTA, NTF, NTB**. These are recognized as correct and won't be flagged as "Unrecognized capitalized word". If you need to add more organizations, you can edit the `freespaceOrgs` Set in the HTML file's `spellCheckString` function.

**Q: Why aren't ship qualifiers like GTF, GTD, NTD, or GTCv being flagged?**

A: The spell checker automatically recognizes ship qualifiers when they're followed by ship names. The detection works by:
1. Checking if the word is 3-4 letters with uppercase letters (except possibly the last)
2. Looking ahead to find the next real word, skipping any $ variables in between
3. Verifying the next word is capitalized (a proper noun ship name)

Examples that are correctly recognized:
- **GTF** Ulysses, **GTD** Philadelphia, **NTD** Repulse (all caps qualifiers)
- **SFr** Moloch, **GTCv** Jamestown (mixed case qualifiers)
- **GTD** $f Philadelphia, **GTCv** $b Jamestown (qualifiers with $ variables between)

If a qualifier-like word appears without a following ship name, it will be spell-checked normally.

**Q: Why aren't ship names and character names being corrected?**

A: **This is intentional!** The spell checker uses a smart heuristic: if a word is capitalized, it's likely a proper noun (ship name, character name, location, etc.) and won't be auto-corrected. Instead, these are flagged in the grammar report for you to review manually. This prevents false positives like changing "Macross" to "macros" or "Aken" to "taken".

**Q: Why are zodiac signs corrected even when capitalized?**

A: Zodiac signs are a special case because they're commonly used in FreeSpace missions (ship names, system names) and have standard spellings that should be enforced. The spell checker recognizes all 12 zodiac signs and common misspellings:
- "Saggitarius" → "Sagittarius"
- "Scorpius" → "Scorpio"  
- "Aquarias" → "Aquarius"

This ensures consistent spelling across missions while still protecting custom proper nouns.

**Q: What if I have a lowercase typo in a proper noun, like "macross" instead of "Macross"?**

A: Lowercase words will be spell-checked and potentially corrected. If "macross" isn't in the dictionary, it might be changed to "macros". In this case, you'll need to manually review and fix it. The tool prioritizes avoiding false positives (incorrectly changing correct proper nouns) over catching every possible typo.

**Q: Why was "we've" changed to "we Ave"?**

A: This should no longer happen! The spell checker now properly recognizes contractions and won't try to spell-check the parts after apostrophes separately. If you're still seeing this issue, please report it.

**Q: Can I add custom words to the dictionary?**

A: Not currently through the interface, but you could manually edit the .dic file before uploading it to add mission-specific terms. Each line in the .dic file represents one word. However, the proper noun protection should handle most mission-specific names automatically.

**Q: Why does it flag capitalized words as "Unrecognized capitalized word"?**

A: This is to alert you that the spell checker found a capitalized word it doesn't recognize. It might be:
- A proper noun (ship name, character, location) - **most likely, no action needed**
- A typo in a proper noun (e.g., "Macrooss") - review and fix manually
- A rare but correctly spelled word - no action needed

You can safely ignore most of these flags as they're usually proper nouns.

**Important:** Each unique proper noun is only listed once in the report, even if it appears many times in the file. For example, if "Actium" appears 50 times, you'll see one entry for "Actium" with one example string, not 50 identical entries. This keeps the report clean and focused.

## Credits

- Spell checking powered by [Typo.js](https://github.com/cfinke/Typo.js) by Christopher Finke
- Created for FreeSpace mission and table file processing

## Authors

Written by Goober5000 and Claude

## License

MIT License

Copyright (c) 2026 Goober5000

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

