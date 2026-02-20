/* When the options page opens:
	•	read settings from chrome.storage.local
	•	fill the form fields
	•	if nothing exists, use defaults

  Default values on open (for example)
	•	apiBaseUrl: "http://localhost:3000"
	•	sourceLang: "auto"
	•	targetLang: "jp"
	•	explanationStyle: "concise"
	•	youtubeFallback: true
	•	debugMode: false

	When user clicks Save:
	•	read values from the form
	•	validate them (especially API URL)
	•	save to chrome.storage.local
	•	show “Saved” message

	When user clicks Reset:
	•	restore default values in the form
	•	optionally save immediately (or wait until Save)

	Validate that:
	•	API URL is not empty
	•	API URL looks like http:// or https://
	•	source and target languages are not identical if source is explicit
*/
