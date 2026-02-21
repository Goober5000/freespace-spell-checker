let dictionary = null;
let selectedFiles = [];
let processedFiles = [];
let revertedCorrections = {}; // key: "fileIndex-corrIndex", value: true if reverted
let totalCorrections = 0;
let totalGrammarIssues = 0;

// Dictionary file handling
let affData = null;
let dicData = null;

// Language configuration - maps language codes to their file naming conventions
const languageConfig = {
    'en_US': { code: 'en_US', affFile: 'en_US.aff', dicFile: 'en_US.dic', path: 'dictionaries/en_US', repoPath: 'en' },
    'en_GB': { code: 'en_GB', affFile: 'en_GB.aff', dicFile: 'en_GB.dic', path: 'dictionaries/en_GB', repoPath: 'en' },
    'en_CA': { code: 'en_CA', affFile: 'en_CA.aff', dicFile: 'en_CA.dic', path: 'dictionaries/en_CA', repoPath: 'en' },
    'en_AU': { code: 'en_AU', affFile: 'en_AU.aff', dicFile: 'en_AU.dic', path: 'dictionaries/en_AU', repoPath: 'en' },
    'en_ZA': { code: 'en_ZA', affFile: 'en_ZA.aff', dicFile: 'en_ZA.dic', path: 'dictionaries/en_ZA', repoPath: 'en' },
    'de_DE': { code: 'de_DE', affFile: 'de_DE.aff', dicFile: 'de_DE.dic', path: 'dictionaries/de_DE', repoPath: 'de' },
    'es_ES': { code: 'es_ES', affFile: 'es_ES.aff', dicFile: 'es_ES.dic', path: 'dictionaries/es_ES', repoPath: 'es' },
    'fr_FR': { code: 'fr_FR', affFile: 'fr_FR.aff', dicFile: 'fr_FR.dic', path: 'dictionaries/fr_FR', repoPath: 'fr_FR' },
    'it_IT': { code: 'it_IT', affFile: 'it_IT.aff', dicFile: 'it_IT.dic', path: 'dictionaries/it_IT', repoPath: 'it_IT' },
    'pt_BR': { code: 'pt_BR', affFile: 'pt_BR.aff', dicFile: 'pt_BR.dic', path: 'dictionaries/pt_BR', repoPath: 'pt_BR' },
    'pl_PL': { code: 'pl_PL', affFile: 'pl_PL.aff', dicFile: 'pl_PL.dic', path: 'dictionaries/pl_PL', repoPath: 'pl_PL' },
    'ru_RU': { code: 'ru_RU', affFile: 'ru_RU.aff', dicFile: 'ru_RU.dic', path: 'dictionaries/ru_RU', repoPath: 'ru_RU' },
    'custom': { code: 'custom', affFile: 'custom.aff', dicFile: 'custom.dic', path: null, repoPath: null }
};

// Get selected language configuration
function getSelectedLanguage() {
    const select = document.getElementById('languageSelect');
    const langCode = select.value;
    return languageConfig[langCode];
}

// Update UI elements based on selected language
function updateLanguageUI() {
    const lang = getSelectedLanguage();
    const isCustom = lang.code === 'custom';
    
    // Show/hide custom dictionary upload section
    const uploadSection = document.getElementById('customDictionaryUpload');
    if (isCustom) {
        uploadSection.style.display = 'block';
    } else {
        uploadSection.style.display = 'none';
    }
    
    // Update file input labels (for custom mode)
    if (isCustom) {
        document.getElementById('affLabel').textContent = '.aff file (affix rules):';
        document.getElementById('dicLabel').textContent = '.dic file (dictionary):';
    }
    
    // Update instructions based on custom vs standard language
    const instructions = document.getElementById('dictionaryInstructions');
    if (isCustom) {
        instructions.style.display = 'block';
        instructions.innerHTML = `
            <strong>Custom Language:</strong> Upload your own dictionary files below.
            <br><br>
            You can find dictionaries for many languages in the <a href="https://github.com/LibreOffice/dictionaries" target="_blank">LibreOffice dictionaries repository</a>.
            <br><br>
            <em style="font-size: 13px; color: #666;">Dictionary files must be in Hunspell format (.aff and .dic).</em>
        `;
    } else {
        instructions.style.display = 'none';
    }
    
    // Clear any loaded dictionary data when switching languages
    affData = null;
    dicData = null;
    dictionary = null;
    document.getElementById('affStatus').textContent = '';
    document.getElementById('dicStatus').textContent = '';
    document.getElementById('dictionaryStatus').innerHTML = '';
    document.getElementById('uploadSection').classList.add('disabled');
    document.getElementById('selectBtn').disabled = true;
    
    // Auto-load dictionary for standard languages
    if (!isCustom) {
        tryAutoLoad();
    }
}

// Language selector change handler
document.getElementById('languageSelect').addEventListener('change', updateLanguageUI);

// Initialize UI with default language
updateLanguageUI();

// Escape user-supplied text before inserting into innerHTML.
// Must be applied to any string that originates from file content or filenames.
function escapeHtml(str) {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Detect file encoding and decode to a JS string.
// Tries strict UTF-8 first; falls back to Windows-1252 if any byte sequence is invalid.
// Pure-ASCII files (valid in both) default to UTF-8 — the bytes are identical either way.
async function detectAndReadFile(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // UTF-8 BOM: EF BB BF.  TextDecoder strips it on decode, so we note it
    // from the raw bytes and re-prepend it on save if it was present.
    const hasBOM = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;

    let encoding, text;
    try {
        // fatal: true throws on any invalid UTF-8 byte sequence
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        encoding = 'utf-8';
    } catch (e) {
        // Single-byte encoding — every byte is valid, so this never throws
        text = new TextDecoder('windows-1252').decode(bytes);
        encoding = 'windows-1252';
    }

    // hasBOM is only meaningful for UTF-8; clear it if we fell back
    return { text, encoding, hasBOM: encoding === 'utf-8' && hasBOM };
}

// Reverse map: Unicode code points → Windows-1252 byte values for the 26
// characters in 0x80–0x9F that Windows-1252 remaps away from Latin-1.
// Outside this range: 0x00–0x7F and 0xA0–0xFF map byte = code point.
const WIN1252_SPECIAL = new Map([
    [0x20AC, 0x80], // €
    [0x201A, 0x82], // ‚
    [0x0192, 0x83], // ƒ
    [0x201E, 0x84], // „
    [0x2026, 0x85], // …
    [0x2020, 0x86], // †
    [0x2021, 0x87], // ‡
    [0x02C6, 0x88], // ˆ
    [0x2030, 0x89], // ‰
    [0x0160, 0x8A], // Š
    [0x2039, 0x8B], // ‹
    [0x0152, 0x8C], // Œ
    [0x017D, 0x8E], // Ž
    [0x2018, 0x91], // '
    [0x2019, 0x92], // '
    [0x201C, 0x93], // "
    [0x201D, 0x94], // "
    [0x2022, 0x95], // •
    [0x2013, 0x96], // –
    [0x2014, 0x97], // —
    [0x02DC, 0x98], // ˜
    [0x2122, 0x99], // ™
    [0x0161, 0x9A], // š
    [0x203A, 0x9B], // ›
    [0x0153, 0x9C], // œ
    [0x017E, 0x9E], // ž
    [0x0178, 0x9F], // Ÿ
]);

// Encode a JS string back to the original file's encoding as a Uint8Array.
// This is the inverse of detectAndReadFile's decode step.
function encodeForDownload(text, encoding, hasBOM) {
    if (encoding === 'windows-1252') {
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
            const cp = text.charCodeAt(i);
            if (WIN1252_SPECIAL.has(cp)) {
                bytes[i] = WIN1252_SPECIAL.get(cp);
            } else if (cp <= 0x7F || (cp >= 0xA0 && cp <= 0xFF)) {
                bytes[i] = cp;  // ASCII and Latin-1 supplement: byte = code point
            } else {
                bytes[i] = 0x3F; // '?' — code point has no Windows-1252 representation
            }
        }
        return bytes;
    }

    // UTF-8 path
    const encoded = new TextEncoder().encode(text);
    if (!hasBOM) return encoded;

    // Original file had a BOM — re-prepend it
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const withBom = new Uint8Array(bom.length + encoded.length);
    withBom.set(bom);
    withBom.set(encoded, bom.length);
    return withBom;
}

function tryAutoLoad() {
    const lang = getSelectedLanguage();
    
    if (lang.code === 'custom') {
        return; // Custom languages don't auto-load
    }
    
    document.getElementById('dictionaryStatus').innerHTML = 
        `<div class="status-message status-info">⏳ Loading ${lang.code} dictionary...</div>`;

    // Use the approach that works: manually fetch files and pass to Typo
    const dictionaryPath = './dictionaries';
    
    async function loadDictionary() {
        try {
            const affPath = `${dictionaryPath}/${lang.code}/${lang.affFile}`;
            const dicPath = `${dictionaryPath}/${lang.code}/${lang.dicFile}`;
            
            console.log(`Loading dictionary: ${lang.code}`);
            console.log(`Fetching: ${affPath}`);
            const affResponse = await fetch(affPath);
            
            console.log(`Fetching: ${dicPath}`);
            const dicResponse = await fetch(dicPath);
            
            if (!affResponse.ok || !dicResponse.ok) {
                throw new Error(`Failed to fetch dictionary files (${affResponse.status}, ${dicResponse.status})`);
            }
            
            const affData = await affResponse.text();
            let dicData = await dicResponse.text();
            
            console.log(`Dictionary files loaded: ${affData.length} bytes (aff), ${dicData.length} bytes (dic)`);
            
            // Validate the dictionary format
            if (!affData || affData.length < 10) {
                throw new Error('AFF file appears to be empty or corrupted');
            }
            if (!dicData || dicData.length < 10) {
                throw new Error('DIC file appears to be empty or corrupted');
            }
            
            // Log first few lines to diagnose format issues
            const affFirstLines = affData.split('\n').slice(0, 5).join('\n');
            const dicFirstLines = dicData.split('\n').slice(0, 5).join('\n');
            console.log('AFF first lines:', affFirstLines);
            console.log('DIC first lines:', dicFirstLines);
            
            // Check .aff file for issues
            const affLines = affData.split('\n');
            console.log(`AFF file has ${affLines.length} lines`);
            
            // Look for SET encoding declaration
            const setLine = affLines.find(line => line.trim().startsWith('SET'));
            if (setLine) {
                console.log('Encoding declaration:', setLine);
            } else {
                console.warn('No SET encoding declaration found in .aff file');
            }
            
            // Some dictionaries (like it_IT) have comment lines in the .dic file
            // starting with '/'. These break Typo.js, so we need to remove them.
            // Standard .dic format should only have: word_count, then word/flags lines
            const dicLines = dicData.split('\n');
            if (dicLines.length > 1 && dicLines[1].trim().startsWith('/')) {
                console.log('Detected comment lines in .dic file - removing them...');
                const originalLineCount = dicLines.length;
                const declaredWordCount = parseInt(dicLines[0]);
                
                console.log(`Original line count: ${originalLineCount}`);
                console.log(`Declared word count: ${declaredWordCount}`);
                
                const cleanedLines = dicLines.filter((line, index) => {
                    // Keep the word count line (we'll update it later)
                    if (index === 0) return true;
                    // Remove comment lines (starting with /) and empty lines
                    const trimmed = line.trim();
                    if (trimmed.startsWith('/') || trimmed === '') return false;
                    // Keep word lines
                    return true;
                });
                
                // Update the word count to match actual number of words
                // cleanedLines has: [word_count_line, word1, word2, ..., wordN]
                const actualWordCount = cleanedLines.length - 1; // Subtract 1 for the count line itself
                cleanedLines[0] = actualWordCount.toString();
                
                console.log(`Removed ${originalLineCount - cleanedLines.length} comment/empty lines`);
                console.log(`Updated word count: ${declaredWordCount} → ${actualWordCount}`);
                console.log(`Expected: 1 (word count) + ${actualWordCount} (words) = ${cleanedLines.length} total lines ✓`);
                
                dicData = cleanedLines.join('\n');
            }
            
            console.log('Creating Typo instance...');
            
            try {
                dictionary = new Typo(lang.code, affData, dicData);
                console.log(`✓ Dictionary loaded successfully (${lang.code})`);
            } catch (typoError) {
                console.error('Typo.js error:', typoError);
                // Typo.js sometimes throws strings instead of Error objects
                const errorMsg = typoError.message || typoError.toString() || 'Unknown error';
                throw new Error(`Typo.js failed to parse dictionary: ${errorMsg}`);
            }
            
            document.getElementById('dictionaryStatus').innerHTML = 
                `<div class="status-message status-success">✓ Dictionary loaded (${lang.code})! You can now process mission and table files.</div>`;
            document.getElementById('uploadSection').classList.remove('disabled');
            document.getElementById('selectBtn').disabled = false;
            
        } catch (error) {
            console.error('Dictionary load error:', error);
            
            // Handle both Error objects and string errors
            let errorMessage = 'Unknown error';
            if (error && error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else if (error) {
                errorMessage = error.toString();
            }
            
            document.getElementById('dictionaryStatus').innerHTML = 
                `<div class="status-message status-error">❌ Failed to load ${lang.code} dictionary: ${escapeHtml(errorMessage)}</div>`;
        }
    }
    
    loadDictionary();
}

document.getElementById('affFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        affData = await file.text();
        document.getElementById('affStatus').textContent = ' ✓ Loaded';
        document.getElementById('affStatus').style.color = '#28a745';
        checkDictionaryReady();
    }
});

document.getElementById('dicFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        dicData = await file.text();
        document.getElementById('dicStatus').textContent = ' ✓ Loaded';
        document.getElementById('dicStatus').style.color = '#28a745';
        checkDictionaryReady();
    }
});

function checkDictionaryReady() {
    if (affData && dicData) {
        const lang = getSelectedLanguage();
        try {
            dictionary = new Typo(lang.code, affData, dicData);
            document.getElementById('dictionaryStatus').innerHTML = 
                `<div class="status-message status-success">✓ Dictionary loaded (${lang.code})! You can now process mission and table files.</div>`;
            document.getElementById('uploadSection').classList.remove('disabled');
            document.getElementById('selectBtn').disabled = false;
        } catch (error) {
            document.getElementById('dictionaryStatus').innerHTML = 
                '<div class="status-message status-error">Error loading dictionary: ' + escapeHtml(error.message) + '</div>';
        }
    }
}

// Disable upload section until dictionary is loaded
document.getElementById('uploadSection').classList.add('disabled');
document.getElementById('selectBtn').disabled = true;

// Setup drag and drop
const uploadSection = document.getElementById('uploadSection');
const fileInput = document.getElementById('fileInput');

uploadSection.addEventListener('dragover', (e) => {
    if (dictionary) {
        e.preventDefault();
        uploadSection.classList.add('drag-over');
    }
});

uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('drag-over');
});

uploadSection.addEventListener('drop', (e) => {
    if (dictionary) {
        e.preventDefault();
        uploadSection.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    }
});

uploadSection.addEventListener('click', (e) => {
    if (dictionary && e.target.tagName !== 'BUTTON') {
        fileInput.click();
    }
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        handleFiles(files);
    }
});

// Static button/checkbox bindings
document.getElementById('selectBtn').addEventListener('click', () => fileInput.click());
document.getElementById('processBtn').addEventListener('click', processFiles);
document.getElementById('clearBtn').addEventListener('click', resetApp);
document.getElementById('showAllItems').addEventListener('change', updateResultsDisplay);
document.getElementById('downloadAllBtn').addEventListener('click', downloadAllFiles);
document.getElementById('processMoreBtn').addEventListener('click', resetApp);

// Delegated listeners for dynamically generated results.
// Elements declare their intent via data-action; these handlers dispatch accordingly.
const resultsContainer = document.getElementById('results');

resultsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="download"]');
    if (btn) {
        downloadFile(Number(btn.dataset.fileIndex));
    }
});

resultsContainer.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset.action === 'toggleAll') {
        toggleAll(Number(target.dataset.fileIndex));
    } else if (target.dataset.action === 'toggleRevert') {
        toggleRevert(Number(target.dataset.fileIndex), Number(target.dataset.corrIndex), target);
    }
});

function handleFiles(files) {
    selectedFiles = files;
    displayFileList();
    document.getElementById('fileListContainer').classList.remove('hidden');
}

function displayFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">${escapeHtml(file.name)}</span>
            <span class="file-status" id="status-${index}">Ready</span>
        `;
        fileList.appendChild(fileItem);
    });
}

async function processFiles() {
    if (!dictionary) {
        alert('Please load dictionary files first!');
        return;
    }

    document.getElementById('fileListContainer').classList.add('hidden');
    document.getElementById('processingContainer').classList.remove('hidden');
    document.getElementById('twoSpacesAfterSentence').disabled = true;
    
    processedFiles = [];
    totalCorrections = 0;
    totalGrammarIssues = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
        document.getElementById('processingStatus').textContent = 
            `Processing ${i + 1} of ${selectedFiles.length}: ${selectedFiles[i].name}`;
        
        const progress = ((i + 1) / selectedFiles.length) * 100;
        document.getElementById('progressFill').style.width = progress + '%';

        try {
            const result = await processFile(selectedFiles[i]);
            processedFiles.push(result);
            totalCorrections += result.corrections;
            totalGrammarIssues += result.grammarIssues.length;
        } catch (error) {
            console.error('Error processing file:', error);
            processedFiles.push({
                fileName: selectedFiles[i].name,
                error: error.message,
                corrections: 0,
                grammarIssues: []
            });
        }
    }

    displayResults();
}

async function processFile(file) {
    const { text, encoding, hasBOM } = await detectAndReadFile(file);
    
    // Extract all XSTR strings
    const xstrStrings = extractXSTRStrings(text);
    console.log(`Found ${xstrStrings.length} XSTR strings in ${file.name}`);
    
    // Extract mission title location
    const titleInfo = extractMissionTitle(text);
    if (titleInfo) {
        console.log(`Found mission title: "${titleInfo.text}"`);
    }
    
    // Process each string
    let correctedText = text;
    let corrections = 0;
    const corrections_list = [];
    const grammarIssues = [];
    const properNounsSeen = new Set(); // Track unique proper nouns
    
    // Create replacement map
    const replacements = new Map();
    
    for (let i = 0; i < xstrStrings.length; i++) {
        const original = xstrStrings[i].text;
        const twoSpaces = document.getElementById('twoSpacesAfterSentence').checked;
        const result = spellCheckString(original, twoSpaces);
        
        if (result.corrected !== original) {
            replacements.set(i, result.corrected);
            corrections++;
            corrections_list.push({
                original: original,
                corrected: result.corrected,
                changes: result.changes,
                stringStart: xstrStrings[i].stringStart,
                stringEnd: xstrStrings[i].stringEnd
            });
        }
        
        // Process grammar issues and deduplicate proper nouns
        if (result.grammarIssues.length > 0) {
            for (const issue of result.grammarIssues) {
                // Check if this is a proper noun issue
                const properNounMatch = issue.match(/Unrecognized capitalized word \(possibly a proper noun\): "([^"]+)"/);
                
                if (properNounMatch) {
                    const properNoun = properNounMatch[1];
                    // Only add if we haven't seen this proper noun before
                    if (!properNounsSeen.has(properNoun)) {
                        properNounsSeen.add(properNoun);
                        grammarIssues.push({
                            text: original,
                            issue: issue
                        });
                    }
                    // If we've seen it before, skip it (deduplicate)
                } else {
                    // Not a proper noun issue, add it normally
                    grammarIssues.push({
                        text: original,
                        issue: issue
                    });
                }
            }
        }
    }
    
    // Apply title casing if needed
    if (titleInfo) {
        for (let i = 0; i < xstrStrings.length; i++) {
            if (xstrStrings[i].stringStart === titleInfo.stringStart) {
                const titleCased = toTitleCase(xstrStrings[i].text);
                if (titleCased !== xstrStrings[i].text) {
                    const existing = replacements.get(i);
                    replacements.set(i, existing ? toTitleCase(existing) : titleCased);
                    
                    const existingCorrection = corrections_list.find(c => c.original === xstrStrings[i].text);
                    if (!existingCorrection) {
                        corrections++;
                        corrections_list.push({
                            original: xstrStrings[i].text,
                            corrected: titleCased,
                            changes: ['Title case conversion'],
                            stringStart: xstrStrings[i].stringStart,
                            stringEnd: xstrStrings[i].stringEnd
                        });
                    } else {
                        existingCorrection.corrected = toTitleCase(existingCorrection.corrected);
                        if (!existingCorrection.changes.includes('Title case conversion')) {
                            existingCorrection.changes.push('Title case conversion');
                        }
                    }
                }
                break;
            }
        }
    }
    
    // Apply replacements in reverse order
    const sortedIndices = Array.from(replacements.keys()).sort((a, b) => b - a);
    
    for (const idx of sortedIndices) {
        const original = xstrStrings[idx];
        const corrected = replacements.get(idx);
        
        const beforeString = correctedText.substring(0, original.stringStart);
        const afterString = correctedText.substring(original.stringEnd);
        correctedText = beforeString + corrected + afterString;
    }
    
    console.log(`Total corrections for ${file.name}: ${corrections}`);
    console.log(`Grammar issues found: ${grammarIssues.length}`);
    console.log(`Unique proper nouns found: ${properNounsSeen.size}`);
    
    return {
        fileName: file.name,
        originalText: text,
        encoding: encoding,
        hasBOM: hasBOM,
        correctedText: correctedText,
        corrections: corrections,
        correctionsList: corrections_list,
        grammarIssues: grammarIssues,
        xstrStringsCount: xstrStrings.length
    };
}

function extractXSTRStrings(text) {
    // Regex to match XSTR ( "string" , number )
    // Handles optional whitespace between components
    const regex = /XSTR\s*\(\s*"([^"]*)"\s*,\s*(-?\d+)\s*\)/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        const stringContent = match[1];
        const xstrStart = match.index;
        const xstrEnd = match.index + fullMatch.length;
        
        // Find where the actual string content starts and ends within the quotes
        const quoteStart = text.indexOf('"', xstrStart) + 1;
        const quoteEnd = quoteStart + stringContent.length;
        
        matches.push({
            text: stringContent,
            stringStart: quoteStart,
            stringEnd: quoteEnd,
            xstrStart: xstrStart,
            xstrEnd: xstrEnd
        });
    }
    
    return matches;
}

function extractMissionTitle(text) {
    const lines = text.split('\n');
    let foundVersion = false;
    
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        
        if (trimmedLine.startsWith('$Version:')) {
            foundVersion = true;
            continue;
        }
        
        if (foundVersion && trimmedLine.startsWith('$Name:')) {
            // Look for XSTR in this line
            const xstrMatch = trimmedLine.match(/XSTR\s*\(\s*"([^"]*)"\s*,\s*(-?\d+)\s*\)/);
            if (xstrMatch) {
                // Find the actual position in the full text
                const beforeLines = lines.slice(0, i).join('\n');
                const lineStart = beforeLines.length + (beforeLines.length > 0 ? 1 : 0);
                const quoteStart = lineStart + lines[i].indexOf('"') + 1;
                
                return {
                    text: xstrMatch[1],
                    stringStart: quoteStart,
                    stringEnd: quoteStart + xstrMatch[1].length
                };
            }
            break;
        }
        
        if (foundVersion && trimmedLine.startsWith('$Author:')) {
            break;
        }
    }
    
    return null;
}

// FreeSpace special tokens - these appear in mission text in place of
// characters that have special meaning in the file format.
// We use Unicode Private Use Area (PUA) chars as intermediaries:
//   - Tokens are replaced with PUA chars before processing
//   - PUA chars act as word boundaries for tokenization (highest fidelity)
//   - PUA chars are replaced back with tokens after processing
// This avoids collisions with literal characters already in the text.
// Sorted longest-first to prevent partial matches (e.g. $semicolon before $slash).
const freespaceTokens = [
    { token: '$semicolon', placeholder: '\uE001' },
    { token: '$quote',     placeholder: '\uE000' },
    { token: '$slash',     placeholder: '\uE002' }
];

function spellCheckString(str, twoSpaces) {
    let corrected = str;
    const changes = [];
    const grammarIssues = [];
    
    // Common abbreviations that end with a period but are not sentence endings
    const abbreviations = new Set([
        'Mr', 'Mrs', 'Ms', 'Dr', 'Lt', 'Cmdr', 'Adm', 'St',
        'Jr', 'Sr', 'Prof', 'Gen', 'Col', 'Maj', 'Capt', 'Sgt',
        'Rev', 'Hon', 'Pres', 'Sen', 'Rep', 'Gov', 'Atty'
    ]);
    
    // FreeSpace organization acronyms - always considered correct
    const freespaceOrgs = new Set([
        'GTA', 'PVN', 'PVE', 'HOL', 'HoL', 'GTVA', 'GVTA', 'NTF', 'NTB', 'IFF', 'GTI', 'SOC', 'ISF', 'GTVI', 'GVTI', 'ETAK', 'BETAC'
    ]);
    
    // FreeSpace-specific words not in standard dictionary
    const freespaceWords = new Set([
        'martialed',      // as in "court-martialed"
        'wingmen',        // plural of wingman
        'nav',            // navigation
        'comm',           // communications (singular)
        'comms',          // communications (plural)
        'waypoint',
        'waypoints',
        'rendezvous',
        'rendez-vous',
        'loadout',
        'Neo-Terra',
        'Zod',
        'zod',
        'Zods',
        'zods'
    ]);
    
    const customCorrections = {
        // Zodiac signs with common misspellings - these should always be corrected
        'Zodiac sign': {
            anyCase: false,
            'aries': 'Aries',
            'taurus': 'Taurus', 'tauras': 'Taurus', 'tauros': 'Taurus',
            'gemini': 'Gemini', 'geminii': 'Gemini',
            'cancer': 'Cancer',
            'leo': 'Leo',
            'virgo': 'Virgo',
            'libra': 'Libra', 'libre': 'Libra',
            'scorpio': 'Scorpio', 'scorpius': 'Scorpio',
            'sagittarius': 'Sagittarius', 'saggitarius': 'Sagittarius', 'sagitarius': 'Sagittarius',
            'capricorn': 'Capricorn', 'capricorne': 'Capricorn',
            'aquarius': 'Aquarius', 'aquarias': 'Aquarius',
            'pisces': 'Pisces', 'piscies': 'Pisces'
        },
        'star': {
            anyCase: false,
            'pegasi': 'Pegasi',
            'aquilae': 'Aquilae', 'aquilea': 'Aquilae',
            'serpentis': 'Serpentis'
        },
        // FreeSpace species - these should always be capitalized (singular and plural)
        'species name': {
            anyCase: false,
            'terran': 'Terran',
            'terrans': 'Terrans',
            'vasuda': 'Vasuda',     // but not Terra, e.g. in "terra firma"
            'vasudan': 'Vasudan',
            'vasudans': 'Vasudans',
            'shivan': 'Shivan',
            'shivans': 'Shivans',
            'ancients': 'Ancients'  // plural only - "ancient" is a common adjective
        },
        'customFixedCase': {
            anyCase: false,
            omitTag: true,
            'hud': 'HUD'
        },
        'customAnyCase': {
            anyCase: true,
            omitTag: true,
            'alright': 'all right',
            'alot': 'a lot',
            'infact': 'in fact',
            'inflight': 'in-flight',
            'enroute': 'en route',
            'turrent': 'turret',
            'redesignated': 're-designated',
            'torpedos': 'torpedoes',
            'battlestations': 'battle stations',
            'aquire': 'acquire',
            'aquired': 'acquired',
            'aquiring': 'acquiring',
            'thats': 'that\'s'
        }
    };
    
    // Abbreviation capitalization corrections - built from the abbreviations set.
    // Maps each abbreviation's lowercase form to its correct capitalized form
    // (e.g. 'dr' → 'Dr', 'cmdr' → 'Cmdr').
    const abbreviationCorrections = {};
    for (const abbr of abbreviations) {
        abbreviationCorrections[abbr.toLowerCase()] = abbr;
    }
    customCorrections['abbreviation'] = abbreviationCorrections;
    
    // Helper function to check if an abbreviation is before a period
    function isAbbreviationBeforePeriod(text, periodIndex) {
        // Look backward to find the word before the period
        let wordStart = periodIndex - 1;
        while (wordStart >= 0 && /[a-zA-Z]/.test(text[wordStart])) {
            wordStart--;
        }
        wordStart++; // Move to first letter of word
        
        const word = text.substring(wordStart, periodIndex);
        return abbreviations.has(word);
    }
    
    // Pre-processing: replace FreeSpace special tokens with PUA placeholders
    // so they act as clean word boundaries during spell/grammar checking
    for (const { token, placeholder } of freespaceTokens) {
        corrected = corrected.split(token).join(placeholder);
    }

    // Curly quote corrections - applied BEFORE spell checking and tokenization
    // so that contractions with curly apostrophes (e.g. it\u2019s) are
    // normalized to straight quotes before the word regex runs.
    const curlyQuoteMap = [
        { curly: '\u2018', straight: "'", name: 'left single'  },  // '
        { curly: '\u2019', straight: "'", name: 'right single' },  // '
        { curly: '\u201C', straight: '"', name: 'left double'  },  // "
        { curly: '\u201D', straight: '"', name: 'right double' },  // "
    ];
    let curlyQuoteCount = 0;
    for (const { curly, straight } of curlyQuoteMap) {
        const matches = corrected.split(curly);
        if (matches.length > 1) {
            curlyQuoteCount += matches.length - 1;
            corrected = matches.join(straight);
        }
    }
    if (curlyQuoteCount > 0) {
        changes.push(`Replaced ${curlyQuoteCount} curly quote(s) with straight quotes`);
    }

    // Space corrections - applied BEFORE spell checking
    let spaceChanges = [];
    
    // 1. Remove spaces before punctuation
    const spacesBeforePunct = corrected.match(/\s+[,\.\?!;:]/g);
    if (spacesBeforePunct) {
        corrected = corrected.replace(/\s+([,\.\?!;:])/g, '$1');
        spaceChanges.push(`Removed ${spacesBeforePunct.length} space(s) before punctuation`);
    }
    
    // 2. Handle multiple spaces and sentence spacing
    if (twoSpaces) {
        // Two spaces after sentences mode
        // First, consolidate 3+ spaces to single space
        const multipleSpaces = corrected.match(/   +/g);
        if (multipleSpaces) {
            corrected = corrected.replace(/   +/g, ' ');
            spaceChanges.push(`Consolidated ${multipleSpaces.length} instance(s) of 3+ spaces to single space`);
        }
        
        // Then, ensure two spaces after sentence-ending punctuation (not abbreviations)
        let singleSpaceCount = 0;
        let newCorrected = '';
        for (let i = 0; i < corrected.length; i++) {
            newCorrected += corrected[i];
            
            // Check if this is sentence-ending punctuation followed by single space
            if (/[\.\?!]/.test(corrected[i]) && corrected[i + 1] === ' ' && corrected[i + 2] !== ' ') {
                // Check if next character after space is uppercase or start of new sentence
                if (i + 2 < corrected.length && /[A-Z"]/.test(corrected[i + 2])) {
                    // Check this isn't an abbreviation
                    if (corrected[i] === '.' && !isAbbreviationBeforePeriod(corrected, i)) {
                        newCorrected += ' '; // Add second space
                        singleSpaceCount++;
                    }
                }
            }
        }
        corrected = newCorrected;
        if (singleSpaceCount > 0) {
            spaceChanges.push(`Added second space after ${singleSpaceCount} sentence(s)`);
        }
    } else {
        // Single space mode - consolidate all multiple spaces
        const multipleSpaces = corrected.match(/  +/g);
        if (multipleSpaces) {
            const totalSpaces = multipleSpaces.reduce((sum, match) => sum + match.length, 0);
            corrected = corrected.replace(/  +/g, ' ');
            spaceChanges.push(`Consolidated ${multipleSpaces.length} instance(s) of multiple spaces (${totalSpaces} spaces → ${multipleSpaces.length} spaces)`);
        }
    }
    
    // 3. Add missing space after punctuation (except for ellipsis)
    let addedSpaces = 0;
    let newCorrected = '';
    for (let i = 0; i < corrected.length; i++) {
        newCorrected += corrected[i];
        
        // Check if this is punctuation followed immediately by a letter
        if (/[,\.\?!;:]/.test(corrected[i]) && i + 1 < corrected.length && /[a-zA-Z]/.test(corrected[i + 1])) {
            // Skip if this is part of ellipsis (... )
            if (corrected[i] === '.' && i >= 2 && corrected[i-1] === '.' && corrected[i-2] === '.') {
                continue;
            }
            // Add space
            newCorrected += ' ';
            addedSpaces++;
        }
    }
    corrected = newCorrected;
    if (addedSpaces > 0) {
        spaceChanges.push(`Added ${addedSpaces} missing space(s) after punctuation`);
    }
    
    // Add space changes to the changes list
    if (spaceChanges.length > 0) {
        changes.push(...spaceChanges);
    }
    
    // Spell check individual words
    // Use regex to properly tokenize words, including $ variables and contractions
    // IMPORTANT: Tokenize the corrected string (after space corrections) so indices match
    const wordRegex = /\$?\w+('\w+)?/g;
    const words = [];
    let match;
    while ((match = wordRegex.exec(corrected)) !== null) {
        words.push({
            text: match[0],
            index: match.index
        });
    }
    
    let wordChanges = [];
    
outerWordLoop:
    for (let i = 0; i < words.length; i++) {
        const word = words[i].text;
        
        // Skip words starting with $ (FreeSpace variables)
        if (word.startsWith('$')) {
            continue;
        }
        
        // Skip purely numeric tokens (numbers)
        if (/^\d+$/.test(word)) {
            continue;
        }
        
        // Skip contractions (words containing apostrophes)
        if (word.includes("'")) {
            continue;
        }
        
        // Skip FreeSpace organization acronyms
        if (freespaceOrgs.has(word)) {
            continue;
        }
        
        // Skip FreeSpace-specific words (case-insensitive)
        if (freespaceWords.has(word.toLowerCase())) {
            continue;
        }
        
        // Check if this is a ship qualifier followed by a proper noun
        // Ship qualifiers are 3-4 letters, mostly uppercase
        if (word.length >= 3 && word.length <= 4) {
            // Check pattern: all letters except possibly the last are uppercase
            let isQualifierPattern = true;
            for (let k = 0; k < word.length - 1; k++) {
                if (!/^[A-Z]$/.test(word[k])) {
                    isQualifierPattern = false;
                    break;
                }
            }
            
            if (isQualifierPattern && /^[a-zA-Z]$/.test(word[word.length - 1])) {
                // Look for the next word (skipping $ variables)
                let nextWord = null;
                for (let j = i + 1; j < words.length; j++) {
                    if (!words[j].text.startsWith('$')) {
                        nextWord = words[j].text;
                        break;
                    }
                }
                
                // If followed by a capitalized word, this is a ship qualifier
                if (nextWord && nextWord[0] === nextWord[0].toUpperCase() && /^[A-Za-z]/.test(nextWord[0])) {
                    continue; // Skip spell-checking ship qualifiers
                }
            }
        }
        
        // Check if this word is in one of our custom lists
        const lowerWord = word.toLowerCase();
        for (const [customTag, customMap] of Object.entries(customCorrections)) {
            if (customMap.anyCase) {
                if (customMap[lowerWord]) {
                    const correctCustom = customMap[lowerWord];
                    // Preserve capitalization: if the original word starts with an uppercase
                    // letter, capitalize the first letter of the replacement as well
                    const suggestion = /^[A-Z]/.test(word)
                        ? correctCustom.charAt(0).toUpperCase() + correctCustom.slice(1)
                        : correctCustom;
                    if (word !== suggestion) {
                        wordChanges.push({
                            original: word,
                            suggestion: suggestion,
                            index: words[i].index,
                            length: word.length,
                            customTag: customMap.omitTag ? undefined : customTag
                        });
                    }
                    continue outerWordLoop;
                }
            } else {
                if (customMap[lowerWord]) {
                    const correctCustom = customMap[lowerWord];
                    if (word !== correctCustom) {
                        wordChanges.push({
                            original: word,
                            suggestion: correctCustom,
                            index: words[i].index,
                            length: word.length,
                            customTag: customMap.omitTag ? undefined : customTag
                        });
                    }
                    continue outerWordLoop; // Skip normal spell checking for this word (whether corrected or not)
                }
            }
        }
        
        // Skip words that start with a capital letter (likely proper nouns)
        const isCapitalized = /^[A-Z]/.test(word[0]);
        
        // Check if word is spelled correctly
        if (!dictionary.check(word)) {
            const suggestions = dictionary.suggest(word, 1);
            
            if (suggestions && suggestions.length > 0) {
                const suggestion = suggestions[0];
                
                // Only auto-correct if:
                // 1. The word is all lowercase (not a proper noun)
                // 2. OR the word has mixed case that looks like a typo
                // BUT: ALL CAPS words should be protected as acronyms
                const isAllCaps = word === word.toUpperCase();
                const hasWeirdMixedCase = word !== word.toLowerCase() && 
                                           word !== word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() &&
                                           !isAllCaps;
                
                if (!isCapitalized || hasWeirdMixedCase) {
                    // Auto-correct lowercase words and obvious typos
                    wordChanges.push({
                        original: word,
                        suggestion: suggestion,
                        index: words[i].index,
                        length: word.length
                    });
                } else {
                    // Capitalized word that's misspelled - likely a proper noun
                    // Report it but don't auto-correct
                    grammarIssues.push(`Unrecognized capitalized word (possibly a proper noun): "${word}"`);
                }
            }
        }
    }
    
    // Apply word corrections in reverse order by index (to maintain positions)
    wordChanges.sort((a, b) => b.index - a.index);
    for (const change of wordChanges) {
        let changeNote;
        if (change.customTag) {
            changeNote = `${change.original} → ${change.suggestion} (${change.customTag})`;
        } else {
            changeNote = `${change.original} → ${change.suggestion}`;
        }
        changes.push(changeNote);
        
        // Replace using index positions
        corrected = corrected.substring(0, change.index) + 
                   change.suggestion + 
                   corrected.substring(change.index + change.length);
    }
    
    // Grammar checks (report only, don't fix)
    
    // Check for potential its/it's confusion (bidirectional)
    for (let i = 0; i < words.length - 1; i++) {
        const currentLower = words[i].text.toLowerCase();
        const nextLower = words[i + 1].text.toLowerCase();
        
        // "its" followed by verb-like words → might need "it's" (it is)
        if (currentLower === 'its') {
            if (['is', 'been', 'being', 'was', 'were', 'a', 'the', 'time', 'going', 'not'].includes(nextLower)) {
                grammarIssues.push(`Check "its" vs "it's" in: "${words[i].text} ${words[i + 1].text}"`);
            }
        }
        
        // "it's" followed by possessive-context words → might need "its" (possessive)
        if (currentLower === "it's") {
            if (['own', 'place', 'way', 'time', 'turn', 'purpose', 'value', 'role', 'nature'].includes(nextLower)) {
                grammarIssues.push(`Check "it's" vs "its" in: "${words[i].text} ${words[i + 1].text}"`);
            }
        }
    }
    
    // Check for potential your/you're confusion (bidirectional)
    for (let i = 0; i < words.length - 1; i++) {
        const currentLower = words[i].text.toLowerCase();
        const nextLower = words[i + 1].text.toLowerCase();
        
        // "your" followed by verb-like words → might need "you're" (you are)
        if (currentLower === 'your') {
            if (['going', 'being', 'not', 'a', 'the', 'all', 'just', 'right', 'wrong', 'welcome', 'sure'].includes(nextLower)) {
                grammarIssues.push(`Check "your" vs "you're" in: "${words[i].text} ${words[i + 1].text}"`);
            }
        }
        
        // "you're" followed by possessive-context words → might need "your" (possessive)
        if (currentLower === "you're") {
            if (['ship', 'fleet', 'orders', 'mission', 'crew', 'team', 'wingman', 'squadron', 'fighter', 'job'].includes(nextLower)) {
                grammarIssues.push(`Check "you're" vs "your" in: "${words[i].text} ${words[i + 1].text}"`);
            }
        }
    }
    
    // Check for potential there/their/they're confusion (all three directions)
    for (let i = 0; i < words.length - 1; i++) {
        const currentLower = words[i].text.toLowerCase();
        const nextLower = words[i + 1].text.toLowerCase();
        
        // "there" followed by possessive-context words → might need "their" (possessive)
        if (currentLower === 'there') {
            if (['ship', 'ships', 'fleet', 'orders', 'mission', 'crew', 'team', 'forces', 'fighters', 'weapons'].includes(nextLower)) {
                grammarIssues.push(`Check "there" vs "their" in: "${words[i].text} ${words[i + 1].text}"`);
            }
        }
        
        // "their" followed by verb-like words → might need "they're" (they are)
        if (currentLower === 'their') {
            if (['going', 'not', 'being', 'coming', 'moving', 'attacking', 'here'].includes(nextLower)) {
                grammarIssues.push(`Check "their" vs "they're" in: "${words[i].text} ${words[i + 1].text}"`);
            }
        }
        
        // "they're" followed by possessive-context words → might need "their" (possessive)
        if (currentLower === "they're") {
            if (['ship', 'ships', 'fleet', 'forces', 'fighters', 'weapons', 'orders'].includes(nextLower)) {
                grammarIssues.push(`Check "they're" vs "their" in: "${words[i].text} ${words[i + 1].text}"`);
            }
        }
    }
    
    // Post-processing: replace PUA placeholders back with FreeSpace special tokens
    for (const { token, placeholder } of freespaceTokens) {
        corrected = corrected.split(placeholder).join(token);
    }
    
    return { corrected, changes, grammarIssues };
}

function toTitleCase(str) {
    const lowerCaseWords = new Set([
        'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
        'nor', 'of', 'on', 'or', 'the', 'to', 'up', 'with', 'via'
    ]);
    
    const words = str.split(/\s+/);
    
    return words.map((word, index) => {
        if (index === 0 || index === words.length - 1) {
            return capitalizeWord(word);
        }
        
        const lowerWord = word.toLowerCase();
        if (lowerCaseWords.has(lowerWord)) {
            return lowerWord;
        }
        
        if (/^[$\(\)\[\]]/.test(word)) {
            return word;
        }
        
        return capitalizeWord(word);
    }).join(' ');
}

function capitalizeWord(word) {
    if (word.length === 0) return word;
    if (/^[^a-zA-Z]/.test(word)) {
        return word[0] + capitalizeWord(word.slice(1));
    }
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function highlightCorrections(text, changes) {
    // Highlight the words that were changed and spacing corrections
    // Replace FreeSpace tokens with PUA placeholders so \b word boundaries
    // work correctly even when words are adjacent to tokens (e.g. $quoteterran)
    let highlighted = text;
    for (const { token, placeholder } of freespaceTokens) {
        highlighted = highlighted.split(token).join(placeholder);
    }

    // Escape user text before inserting any HTML marks.
    // All subsequent regex searches must match against the escaped text.
    highlighted = escapeHtml(highlighted);
    
    for (const change of changes) {
        // Handle word changes: "recieve → receive" or "Saggitarius → Sagittarius (zodiac sign)"
        const wordMatch = change.match(/^(.+?)\s*→\s*(.+?)(\s*\(.*\))?$/);
        if (wordMatch) {
            const original = wordMatch[1].trim();
            const originalEscaped = escapeHtml(original);
            // Escape special regex characters in the HTML-escaped word
            const regexEscaped = originalEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${regexEscaped}\\b`, 'g');
            highlighted = highlighted.replace(regex, `<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">${originalEscaped}</mark>`);
        }
        
        // Handle spacing corrections
        // Note: These highlights show where spaces WERE before correction, not after
        
        // "Removed X space(s) before punctuation"
        // In the original text, highlight " ." patterns (space before punctuation)
        if (change.includes('space(s) before punctuation')) {
            // This will highlight spaces that were originally before punctuation
            // Since we're showing the "before" text, the spaces are still there
            highlighted = highlighted.replace(/(\s+)([,\.\?!;:])/g, 
                '<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">$1</mark>$2');
        }
        
        // "Consolidated X instance(s) of multiple spaces"
        if (change.includes('multiple spaces')) {
            // Highlight runs of 2+ spaces
            highlighted = highlighted.replace(/(  +)/g, 
                '<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">$1</mark>');
        }
        
        // "Added X missing space(s) after punctuation"
        if (change.includes('missing space(s) after punctuation')) {
            // Highlight punctuation that's directly followed by a letter (no space)
            highlighted = highlighted.replace(/([,\.\?!;:])([a-zA-Z])/g, 
                '$1<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">⎵</mark>$2');
        }
        
        // "Added second space after X sentence(s)"
        if (change.includes('second space after')) {
            // Highlight single spaces after sentence-ending punctuation
            // This is trickier - we'll mark the space that will become two spaces
            highlighted = highlighted.replace(/([\.\?!]) ([A-Z]|&quot;)/g, 
                '$1<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;"> </mark>$2');
        }
        
        // "Replaced X curly quote(s) with straight quotes"
        // escapeHtml does not touch curly quote characters, so they are still
        // present verbatim in the "before" text and can be matched directly.
        if (change.includes('curly quote')) {
            highlighted = highlighted.replace(/[\u2018\u2019\u201C\u201D]/g,
                match => `<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">${match}</mark>`);
        }
    }
    
    // Restore FreeSpace tokens from PUA placeholders
    for (const { token, placeholder } of freespaceTokens) {
        highlighted = highlighted.split(placeholder).join(token);
    }
    return highlighted;
}

function highlightGrammarIssue(text, issue) {
    // All grammar issues use light blue highlight (#d1ecf1) for consistency
    // since they appear on orange text (#856404)
    const highlightColor = '#d1ecf1';
    
    // Replace FreeSpace tokens with PUA placeholders so \b word boundaries
    // work correctly even when words are adjacent to tokens
    let highlighted = text;
    for (const { token, placeholder } of freespaceTokens) {
        highlighted = highlighted.split(token).join(placeholder);
    }

    // Escape user text before inserting any HTML marks.
    // All subsequent regex searches must match against the escaped text.
    highlighted = escapeHtml(highlighted);
    
    // Extract the problematic phrase from issue description
    // Patterns: 'Check "its" vs "it's" in: "its going"'
    const inMatch = issue.match(/in:\s*"([^"]+)"/);
    if (inMatch) {
        const phrase = inMatch[1];
        const phraseEscaped = escapeHtml(phrase);
        const regexEscaped = phraseEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(regexEscaped, 'gi');
        highlighted = highlighted.replace(regex, `<mark style="background: ${highlightColor}; padding: 2px 4px; border-radius: 3px;">${phraseEscaped}</mark>`);
    } else {
        // Pattern: 'Unrecognized capitalized word (possibly a proper noun): "Word"'
        const wordMatch = issue.match(/:\s*"([^"]+)"/);
        if (wordMatch) {
            const word = wordMatch[1];
            const wordEscaped = escapeHtml(word);
            const regexEscaped = wordEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${regexEscaped}\\b`, 'g');
            highlighted = highlighted.replace(regex, `<mark style="background: ${highlightColor}; padding: 2px 4px; border-radius: 3px;">${wordEscaped}</mark>`);
        }
    }
    
    // Restore FreeSpace tokens from PUA placeholders
    for (const { token, placeholder } of freespaceTokens) {
        highlighted = highlighted.split(placeholder).join(token);
    }
    return highlighted;
}

function displayResults() {
    document.getElementById('processingContainer').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');
    
    document.getElementById('totalFiles').textContent = processedFiles.length;
    document.getElementById('totalCorrections').textContent = totalCorrections;
    document.getElementById('totalGrammar').textContent = totalGrammarIssues;
    
    renderResults();
}

function updateResultsDisplay() {
    renderResults();
}

function renderResults() {
    const showAll = document.getElementById('showAllItems').checked;
    const correctionsLimit = showAll ? Infinity : 15;
    const grammarLimit = showAll ? Infinity : 20;
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    
    processedFiles.forEach((result, index) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.dataset.fileIndex = index;
        
        let content = `
            <div class="result-header">
                <div class="result-title">${escapeHtml(result.fileName)}</div>
                <button class="btn btn-small" data-action="download" data-file-index="${index}">Download</button>
            </div>
        `;
        
        if (result.error) {
            content += `
                <div class="status-message status-error">
                    Error: ${escapeHtml(result.error)}
                </div>
            `;
        } else {
            content += `
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-value">${result.xstrStringsCount}</div>
                        <div class="stat-label">XSTR Strings</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${result.corrections}</div>
                        <div class="stat-label">Corrections Made</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${result.grammarIssues.length}</div>
                        <div class="stat-label">Grammar Issues</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${result.encoding === 'windows-1252' ? 'Win-1252' : (result.hasBOM ? 'UTF-8 (BOM)' : 'UTF-8')}</div>
                        <div class="stat-label">Encoding</div>
                    </div>
                </div>
            `;
            
            if (result.correctionsList && result.correctionsList.length > 0) {
                const correctionsToShow = result.correctionsList.slice(0, correctionsLimit);
                const remainingCorrections = result.correctionsList.length - correctionsToShow.length;

                // Master checkbox state: computed across ALL corrections, not just visible
                let revertedCount = 0;
                for (let ci = 0; ci < result.correctionsList.length; ci++) {
                    if (revertedCorrections[`${index}-${ci}`]) revertedCount++;
                }
                const masterState = revertedCount === 0 ? 'all'
                                  : revertedCount === result.correctionsList.length ? 'none'
                                  : 'mixed';
                
                content += `
                    <div class="corrections-section">
                        <div class="section-title">✏️ Corrections Applied:</div>
                        <div class="master-checkbox-row">
                            <input type="checkbox" id="masterCheck-${index}" ${masterState === 'all' ? 'checked' : ''} data-state="${masterState}" data-action="toggleAll" data-file-index="${index}">
                            <label for="masterCheck-${index}">Select all corrections</label>
                        </div>
                        ${correctionsToShow.map((corr, corrIdx) => {
                            const isReverted = revertedCorrections[`${index}-${corrIdx}`] || false;
                            const highlightedBefore = highlightCorrections(corr.original, corr.changes);
                            const highlightedAfter = highlightCorrections(corr.corrected, corr.changes);
                            return `
                            <div class="correction-item ${isReverted ? 'reverted' : ''}">
                                <div class="correction-checkbox">
                                    <input type="checkbox" ${isReverted ? '' : 'checked'} data-action="toggleRevert" data-file-index="${index}" data-corr-index="${corrIdx}">
                                    <span class="revert-badge">Reverted</span>
                                </div>
                                <div class="item-text" style="color: #155724;">
                                    <strong>Changes:</strong> ${escapeHtml(corr.changes.join(', '))}
                                </div>
                                <div class="item-note" style="color: #155724;">
                                    <strong>Before:</strong> "${highlightedBefore}"
                                </div>
                                <div class="item-note" style="color: #155724;">
                                    <strong>After:</strong> "${highlightedAfter}"
                                </div>
                            </div>
                        `}).join('')}
                        ${remainingCorrections > 0 ? `<p style="text-align: center; color: #6c757d; margin-top: 10px;">...and ${remainingCorrections} more (enable "Show all items" to review)</p>` : ''}
                    </div>
                `;
            }
            
            if (result.grammarIssues.length > 0) {
                const grammarToShow = result.grammarIssues.slice(0, grammarLimit);
                const remainingGrammar = result.grammarIssues.length - grammarToShow.length;
                
                content += `
                    <div class="grammar-issues">
                        <div class="section-title">⚠️ Grammar Issues (Review Manually):</div>
                        ${grammarToShow.map(issue => {
                            const highlightedText = highlightGrammarIssue(issue.text, issue.issue);
                            return `
                            <div class="grammar-item">
                                <div class="item-note" style="color: #856404;">${escapeHtml(issue.issue)}</div>
                                <div class="item-text" style="color: #856404;">"${highlightedText}"</div>
                            </div>
                        `}).join('')}
                        ${remainingGrammar > 0 ? `<p style="text-align: center; color: #6c757d; margin-top: 10px;">...and ${remainingGrammar} more</p>` : ''}
                    </div>
                `;
            }
        }
        
        card.innerHTML = content;
        resultsDiv.appendChild(card);

        // indeterminate can only be set via JS, not HTML — do it after the element is in the DOM
        const masterCB = card.querySelector(`#masterCheck-${index}`);
        if (masterCB && masterCB.dataset.state === 'mixed') {
            masterCB.indeterminate = true;
        }
    });
}

function toggleRevert(fileIdx, corrIdx, checkbox) {
    const key = `${fileIdx}-${corrIdx}`;
    if (checkbox.checked) {
        delete revertedCorrections[key];
    } else {
        revertedCorrections[key] = true;
    }
    // Toggle .reverted class on the parent correction-item without re-rendering
    const item = checkbox.closest('.correction-item');
    item.classList.toggle('reverted', !checkbox.checked);
    // Keep master checkbox in sync
    updateMasterCheckbox(fileIdx);
}

function toggleAll(fileIdx) {
    const masterCB = document.getElementById(`masterCheck-${fileIdx}`);
    const applyAll = masterCB.checked;
    const result = processedFiles[fileIdx];

    // Update revertedCorrections for every correction in this file
    for (let i = 0; i < result.correctionsList.length; i++) {
        const key = `${fileIdx}-${i}`;
        if (applyAll) {
            delete revertedCorrections[key];
        } else {
            revertedCorrections[key] = true;
        }
    }

    // Update all visible correction items in this file's card
    const card = document.querySelector(`.result-card[data-file-index="${fileIdx}"]`);
    card.querySelectorAll('.correction-item').forEach(item => {
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb) {
            cb.checked = applyAll;
            item.classList.toggle('reverted', !applyAll);
        }
    });

    masterCB.indeterminate = false;
}

function updateMasterCheckbox(fileIdx) {
    const masterCB = document.getElementById(`masterCheck-${fileIdx}`);
    if (!masterCB) return;

    const total = processedFiles[fileIdx].correctionsList.length;
    let revertedCount = 0;
    for (let i = 0; i < total; i++) {
        if (revertedCorrections[`${fileIdx}-${i}`]) revertedCount++;
    }

    if (revertedCount === 0) {
        masterCB.checked = true;
        masterCB.indeterminate = false;
    } else if (revertedCount === total) {
        masterCB.checked = false;
        masterCB.indeterminate = false;
    } else {
        masterCB.indeterminate = true;
    }
}

// Rebuild corrected text from originalText, applying only non-reverted corrections
function buildCorrectedText(result, fileIndex) {
    let text = result.originalText;

    // Filter to non-reverted corrections, sort by stringStart descending (reverse order)
    const activeCorrections = result.correctionsList
        .map((corr, idx) => ({ ...corr, _idx: idx }))
        .filter(corr => !revertedCorrections[`${fileIndex}-${corr._idx}`])
        .sort((a, b) => b.stringStart - a.stringStart);

    for (const corr of activeCorrections) {
        text = text.substring(0, corr.stringStart) + corr.corrected + text.substring(corr.stringEnd);
    }

    return text;
}

function downloadFile(index) {
    const result = processedFiles[index];
    if (result.error) return;
    
    const correctedText = buildCorrectedText(result, index);
    const bytes = encodeForDownload(correctedText, result.encoding, result.hasBOM);
    const blob = new Blob([bytes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Check if user wants original filenames or _corrected suffix
    const useOriginal = document.getElementById('useOriginalFilenames').checked;
    if (useOriginal) {
        a.download = result.fileName;
    } else {
        a.download = result.fileName.replace(/\.(fs2|tbl|tbm|txt)$/, '_corrected$&');
    }
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadAllFiles() {
    processedFiles.forEach((result, index) => {
        if (!result.error) {
            setTimeout(() => downloadFile(index), index * 200);
        }
    });
}

function resetApp() {
    selectedFiles = [];
    processedFiles = [];
    revertedCorrections = {};
    totalCorrections = 0;
    totalGrammarIssues = 0;
    
    document.getElementById('fileInput').value = '';
    document.getElementById('fileListContainer').classList.add('hidden');
    document.getElementById('processingContainer').classList.add('hidden');
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('twoSpacesAfterSentence').disabled = false;
}
