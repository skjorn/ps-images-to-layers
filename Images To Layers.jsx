// NAME:
// 	Images To Layers

// DESCRIPTION:
//   Cheap alternative of "Load Files Into Stack" script that came with CS3.

// REQUIRES:
// 	Adobe Photoshop CS2

// Most current version always available at: https://github.com/...

// enable double-clicking from Finder/Explorer (CS2 and higher)
#target photoshop
app.bringToFront();

//
// Type definitions
//


//
// Global variables
//

var env = new Object();
env.profiling = false;

var prefs = new Object();


//
// Entry point
//

bootstrap();

//
// Processing logic
//

function main()
{
	// user preferences
	prefs = new Object();
	prefs.srcFolder = Folder.myDocuments;

	// show dialogue
	if (showDialog()) {
		// TODO: subfolders, extension filter
		var files = prefs.srcFolder.getFiles();
		loadLayers(files);
		alert("Done!", "Finished", false);
	}
	else {
		return "cancel";
	}
}

function loadLayers(files)
{
	if (files.length == 0) {
		return;
	}
	
	var firstFile = open(files[0]);
	
	var doc = documents.add(
		firstFile.width,
		firstFile.height,
		firstFile.resolution,
		"Untitled",
		NewDocumentMode.RGB,
		DocumentFill.TRANSPARENT,
		1
	);
	
	copyLayers(firstFile, doc);	
	firstFile.close(SaveOptions.DONOTSAVECHANGES);
	
	for (var i = 1; i < files.length; ++i) {
		var file = open(files[i]);
		copyLayers(file, doc);	
		file.close(SaveOptions.DONOTSAVECHANGES);
	}
	
	activeDocument = doc;
	doc.layers[doc.layers.length - 1].remove();
	doc.revealAll();
}

function copyLayers(src, dst)
{
	activeDocument = src;
	if ((src.layers.length == 1) && src.layers[0].isBackgroundLayer) {
		var copy = src.layers[0].duplicate(dst, ElementPlacement.PLACEATBEGINNING);
		activeDocument = dst;
		copy.name = stripExt(src.name);
	}
	else {
		for (var i = 0; i < src.layers.length; ++i) {
			src.layers[i].duplicate(dst, ElementPlacement.PLACEATBEGINNING);
		}
	}
}

//
// User interface
//

function showDialog()
{
	// read dialog resource
	var rsrcFile = new File(env.scriptFileDirectory + "/dialog.json");
	var rsrcString = loadResource(rsrcFile);
	if (! rsrcString) {
		return false;
	}

	// build dialogue
	var dlg;
	try {
		dlg = new Window(rsrcString);
	}
	catch (e) {
		alert("Dialog resource is corrupt! Please, redownload the script with all files.", "Error", true);
		return false;
	}

	// destination path
	dlg.funcArea.content.grpDest.txtDest.text = prefs.srcFolder.fsName;
	dlg.funcArea.content.grpDest.btnDest.onClick = function() {
		var newFilePath = Folder.selectDialog("Select destination folder", prefs.srcFolder);
		if (newFilePath) {
			prefs.srcFolder = newFilePath;
			dlg.funcArea.content.grpDest.txtDest.text = newFilePath.fsName;
		}
	};
	
	// buttons
	dlg.funcArea.buttons.btnRun.onClick = function() {
		dlg.close(1);
	};
	dlg.funcArea.buttons.btnCancel.onClick = function() {
		dlg.close(0);
	};

	dlg.center();
	return dlg.show();
}


//
// Bootstrapper (version support, getting additional environment settings, error handling...)
//

function bootstrap()
{
	function showError(err) {
		alert(err + ': on line ' + err.line, 'Script Error', true);
	}

	// initialisation of class methods
	defineProfilerMethods();

	try {
		// setup the environment

		env = new Object();

		env.version = parseInt(app.version, 10);

		if (env.version < 9) {
			alert("Photoshop versions before CS2 are not supported!", "Error", true);
			return "cancel";
		}

		env.cs3OrHigher = (env.version >= 10);

		// get script's file name
		if (env.cs3OrHigher) {
			env.scriptFileName = $.fileName;
		}
		else {
			try {
				//throw new Error();		// doesn't provide the file name, at least in CS2
				var illegal = RUNTIME_ERROR;
			}
			catch (e) {
				env.scriptFileName = e.fileName;
			}
		}

		env.scriptFileDirectory = (new File(env.scriptFileName)).parent;

		// run the script itself
		main();
	}
	catch(e) {
		// report errors unless the user cancelled
		if (e.number != 8007) showError(e);
		return "cancel";
	}
}


//
// Utilities
//

function padder(input, padLength)
{
	// pad the input with zeroes up to indicated length
	var result = (new Array(padLength + 1 - input.toString().length)).join('0') + input;
	return result;
}

function makeValidFileName(fileName, replaceSpaces)
{
	var validName = fileName.replace(/^\s+|\s+$/gm, '');	// trim spaces
	validName = validName.replace(/[\\\*\/\?:"\|<>]/g, ''); // remove characters not allowed in a file name
	if (replaceSpaces) {
		validName = validName.replace(/[ ]/g, '_');			// replace spaces with underscores, since some programs still may have troubles with them
	}
	return validName;
}

function stripExt(name)
{
	var dotIdx = name.indexOf('.');
	if (dotIdx >= 0) {
		name = name.substring(0, dotIdx);
	}
	
	return name;
}

function formatString(text)
{
	var args = Array.prototype.slice.call(arguments, 1);
	return text.replace(/\{(\d+)\}/g, function(match, number) {
		return (typeof args[number] != 'undefined') ? args[number] : match;
	});
}

function loadResource(file)
{
	var rsrcString;
	if (! file.exists) {
		alert("Resource file '" + file.name + "' for the export dialog is missing! Please, download the rest of the files that come with this script.", "Error", true);
		return false;
	}
	try {
		file.open("r");
		if (file.error) throw file.error;
		rsrcString = file.read();
		if (file.error) throw file.error;
		if (! file.close()) {
			throw file.error;
		}
	}
	catch (error) {
		alert("Failed to read the resource file '" + file.name + "'!\n\nReason: " + error + "\n\nPlease, check it's available for reading and redownload it in case it became corrupted.", "Error", true);
		return false;
	}

	return rsrcString;
}

function Profiler(enabled)
{
	this.enabled = enabled;
	if (this.enabled) {
		this.startTime = new Date();
		this.lastTime = this.startTime;
	}
}

function defineProfilerMethods()
{
	Profiler.prototype.getDuration = function(rememberAsLastCall, sinceLastCall)
	{
		if (this.enabled) {
			var currentTime = new Date();
			var lastTime = sinceLastCall ? this.lastTime : this.startTime;
			if (rememberAsLastCall) {
				this.lastTime = currentTime;
			}
			return new Date(currentTime.getTime() - lastTime.getTime());
		}
	}

	Profiler.prototype.resetLastTime = function()
	{
		this.lastTime = new Date();
	};

	Profiler.prototype.format = function(duration)
	{
		var output = padder(duration.getUTCHours(), 2) + ":";
		output += padder(duration.getUTCMinutes(), 2) + ":";
		output += padder(duration.getUTCSeconds(), 2) + ".";
		output += padder(duration.getUTCMilliseconds(), 3);
		return output;
	};
}
