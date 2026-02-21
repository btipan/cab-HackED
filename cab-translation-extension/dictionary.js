require('dotenv').config();

const axios = require('axios').default;
const { v4: uuidv4 } = require('uuid');

const key = process.env.TRANSLATOR_KEY;
const endpoint = "https://api.cognitive.microsofttranslator.com";
const location = process.env.TRANSLATOR_REGION;

const sourceWord = "タクシー";
const sourceLang = 'ja'

async function getTranslationAndExample(word, sourceLang) {
    try {
        // Dictionary lookup
        const lookupResp = await axios({
            baseURL: endpoint,
            url: '/dictionary/lookup',
            method: 'post',
            headers: {
                'Ocp-Apim-Subscription-Key': key,
                'Ocp-Apim-Subscription-Region': location,
                'Content-type': 'application/json',
                'X-ClientTraceId': uuidv4().toString()
            },
            params: {
                'api-version': '3.0',
                'from': sourceLang,
                'to': 'en'
            },
            data: [{ text: word }],
            responseType: 'json'
        });

        const translations = lookupResp.data[0].translations;

        // For each translation, get one example sentence
        for (let t of translations) {
            const engWord = t.normalizedTarget;

            const exampleResp = await axios({
                baseURL: endpoint,
                url: '/dictionary/examples',
                method: 'post',
                headers: {
                    'Ocp-Apim-Subscription-Key': key,
                    'Ocp-Apim-Subscription-Region': location,
                    'Content-type': 'application/json',
                    'X-ClientTraceId': uuidv4().toString()
                },
                params: {
                    'api-version': '3.0',
                    'from': 'en',
                    'to': sourceLang
                },
                data: [
                    {
                        text: engWord,
                        translation: word
                    }
                ],
                responseType: 'json'
            });

            const examples = exampleResp.data[0].examples;
            if (examples.length > 0) {
                const ex = examples[0]; // pick first example
                console.log(`\nTranslation: ${engWord}`);
                console.log(`Example (EN): ${ex.sourcePrefix}${ex.sourceTerm}${ex.sourceSuffix}`);
                console.log(`Example (${sourceLang.toUpperCase()}): ${ex.targetPrefix}${ex.targetTerm}${ex.targetSuffix}`);
            } else {
                console.log(`\nTranslation: ${engWord}`);
                console.log("No example available.");
            }
        }

    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}

getTranslationAndExample(sourceWord, sourceLang);