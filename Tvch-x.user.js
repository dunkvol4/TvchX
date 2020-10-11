// ==UserScript==
// @name        TvchX
// @namespace   TvchX
// @version     3.0.2.1
// @description Small userscript to improve tvch.moe
// @grant       none

// @require     https://code.jquery.com/ui/1.11.2/jquery-ui.min.js
// @require     https://github.com/alexei/sprintf.js/raw/master/src/sprintf.js
// @require     https://raw.githubusercontent.com/rmm5t/jquery-timeago/master/jquery.timeago.js
// @require     https://raw.githubusercontent.com/samsonjs/strftime/master/strftime.js

// @match       *://tvch.moe/*
// @match       *://smuglo.li/*

// ==/UserScript==

/*Contributors
** tux3
** Zaphkiel
** varemenos
** 7185
** anonish
** Pashe
** vol4
*/

function chxErrorHandler(e, section) {
	console.error(e);
	console.trace();
	
	var rptObj = { //Chrome needs this
		name:          e?(e.name||"unknown"):"VERY unknown",
		msg:           e?(e.message||"unknown"):"VERY unknown",
		file:          e?((e.fileName||"unknown").split("/").slice(-1).join("")):"VERY unknown",
		line:          e?(e.lineNumber||"?"):"???",
		col:           e?(e.columnNumber||"?"):"???",
		section:       (section||"unknown"),
		scriptName:    (GM_info&&GM_info.script)?(GM_info.script.name||"unknown"):"VERY unknown",
		scriptVersion: (GM_info&&GM_info.script)?(GM_info.script.version||"unknown"):"VERY unknown",
		gmVersion:     (GM_info&&GM_info.version)?(GM_info.version||"unknown"):"VERY unknown",
		activePage:    window?(window.active_page||"unknown"):"VERY unknown",
		browser:       (window&&window.navigator)?((window.navigator.userAgent||"unknown").match(/(Chrom\S*|\S*fox\/\S*|Ice\S*)/gi)||["unknown"]).join(", "):"VERY unknown",
		userAgent:     (window&&window.navigator)?(window.navigator.userAgent||"unknown"):"VERY unknown",
		location:      (window&&window.location)?(window.location.href||"unknown"):"VERY unknown",
		stack:         e?((e.stack||"unknown").replace(/file:[^ \n]*\//g, "file:").replace(/^/gm, "  ")):"VERY unknown",
	};
	
	console.error(sprintf(
		"TvchX experienced an error. Please include the following information with your report:\n"+
		"[code]%s in %s/%s @ L%s C%s: %s\n\nVersion: %s (@%s)\nGreasemonkey: %s\nActive page: %s\nBrowser: %s\nUser agent: %s\nLocation: %s\nStack:\n%s[/code]",
		rptObj.name, rptObj.file, rptObj.section, rptObj.line, rptObj.col, rptObj.msg,
		rptObj.scriptName, rptObj.scriptVersion,
		rptObj.gmVersion,
		rptObj.activePage,
		rptObj.browser,
		rptObj.userAgent,
		rptObj.location,
		rptObj.stack
	));
	
	alert("TvchX experienced an error. Check the console for details (typically F12).");
}

try {
////////////////
//GLOBAL VARIABLES
////////////////
//Constants
var bumpLimit = 300;

//Initializations
var thisThread;
var cachedPages = null;
var galleryImages;
var galleryImageIndex;

//Dynamic
var isMod = (window.location.pathname.split("/")[1]=="mod.php");
var thisBoard = isMod?window.location.href.split("/")[4]:window.location.pathname.split("/")[1];
try {thisThread = parseInt(window.location.href.match(/([0-9]+)\.html/)[1]);} catch (e) {thisThread = -1;}
var thisBoardAnonName;
var thisBoardSettings;

////////////////
//SETTINGS
////////////////
var settingsMenu = window.document.createElement('div');

if (window.Options) {
	var tab = window.Options.add_tab('TvchX', 'times', 'TvchX');
	$(settingsMenu).appendTo(tab.content);
}

settingsMenu.innerHTML = sprintf('<span style="font-size:8pt;">TvchX %s</span>', GM_info.script.version)
+ '<div style="overflow:auto;height:100%;">' //General
+ '<label><input type="checkbox" name="catalogLinks">' + 'Force catalog links on favorite boards.' + '</label><br>'
+ '<label><input type="checkbox" name="revealImageSpoilers">' + 'Reveal image spoilers' + '</label><br>'
+ '<label><input type="checkbox" name="GifAnimate">' + 'Animate GIF thumbnails' + '</label><br>'
+ '<label><input type="checkbox" name="hideNoFilePosts">' + 'Hide posts without files' + '</label><br>'
+ '<label><input type="checkbox" name="keyboardShortcutsEnabled">' + 'Enable keyboard shortcuts' + '</label><br>'
+ '<hr>' //How information is displayed
+ '<label><input type="checkbox" name="reverseImageSearch">' + 'Add more reverse image search links' + '</label><br>'
+ '<label><input type="checkbox" name="parseTimestampImage">' + 'Guess original download date of imageboard-style filenames' + '</label><br>'
+ '<label><input type="checkbox" name="precisePages">' + 'Increase page indicator precision' + '</label><br>'
+ '<label><input type="checkbox" name="failToCatalogPages">' + 'Get thread page from catalog.html if thread is not in threads.json' + '</label><br>'
+ '<label>' + 'Mascot URL(s) (pipe separated):<br />' + '<input type="text" name="mascotUrl" style="width: 30em"></label><br>'
+ '<label>' + '<a href="http://strftime.net/">Date format</a>:<br />' + '<input type="text" name="dateFormat" style="width:30em"></label><br>'
+ '<label><input type="checkbox" name="localTime">' + 'Use local time' + '</label><br>'
+ '<hr>' //Filters
+ '<h3>Filters</h3>'
+ '<table style="text-align:center;">'
+ '<tr><th>Field</th><th title="Regular expressions seperated with &quot;````&quot;. Boards may be specified like this: &quot;fag```a,b,c&quot;, which will filter &quot;fag&quot; on /a/, /b/, and /c/">Regex</th><th title="Recursive: If this is checked, replies to filtered posts will also be removed">R</th><th title="Stubs: If this is not checked, filtered posts will be removed completely">S</th><th title="All: If this is checked, all posts of this type will be removed, ignoring regex">A</th></tr>'

+ '<tr><td class="chx_FilterField">Tripcode</td><td><input type="text" name="filterTripsRegex" style="width:25em"></td><td><input type="checkbox" name="filterTripsRecursive"></td><td><input type="checkbox" name="filterTripsStubs"></td><td><input type="checkbox" name="filterTrips"></td></tr>'

+ '<tr><td class="chx_FilterField">Name</td><td><input type="text" name="filterNamesRegex" style="width:25em"></td><td><input type="checkbox" name="filterNamesRecursive"></td><td><input type="checkbox" name="filterNamesStubs"></td><td><input type="checkbox" name="filterNames"></td></tr>'

+ '<tr><td class="chx_FilterField">Body</td><td><input type="text" name="filterBodyRegex" style="width:25em"></td><td><input type="checkbox" name="filterBodyRecursive"></td><td><input type="checkbox" name="filterBodyStubs"></td><td><input type="checkbox" name="filterBody"></td></tr>'

+ '<tr><td class="chx_FilterField">Email</td><td><input type="text" name="filterEmailRegex" style="width:25em"></td><td><input type="checkbox" name="filterEmailRecursive"></td><td><input type="checkbox" name="filterEmailStubs"></td><td><input type="checkbox" name="filterEmail"></td></tr>'

+ '<tr><td class="chx_FilterField">Subject</td><td><input type="text" name="filterSubjectRegex" style="width:25em"></td><td><input type="checkbox" name="filterSubjectRecursive"></td><td><input type="checkbox" name="filterSubjectStubs"></td><td><input type="checkbox" name="filterSubject"></td></tr>'

+ '<tr><td class="chx_FilterField">Flag</td><td><input type="text" name="filterFlagRegex" style="width:25em"></td><td><input type="checkbox" name="filterFlagRecursive"></td><td><input type="checkbox" name="filterFlagStubs"></td><td><input type="checkbox" name="filterFlag"></td></tr>'

+ '</table>'
+ '<hr>' //Other shit
+ '<h3>Off-Site Favorites</h3>'
+ '<label><input type="checkbox" name="offSiteFaves">' + 'Enable Off-Site Favorites' + '</label><br>'
+ '<table style="text-align:center;">'
+ '<tr><td class="chx_FaveField">Board Name</td><td><input type="text" name="favBoardName1" style="width:12em"></td><td class="chx_FaveField">Board URL</td><td><input type="text" name="favBoardURL1" style="width:12em"></td>'
+ '<tr><td class="chx_FaveField">Board Name</td><td><input type="text" name="favBoardName2" style="width:12em"></td><td class="chx_FaveField">Board URL</td><td><input type="text" name="favBoardURL2" style="width:12em"></td>'
+ '<tr><td class="chx_FaveField">Board Name</td><td><input type="text" name="favBoardName3" style="width:12em"></td><td class="chx_FaveField">Board URL</td><td><input type="text" name="favBoardURL3" style="width:12em"></td>'
+ '<tr><td class="chx_FaveField">Board Name</td><td><input type="text" name="favBoardName4" style="width:12em"></td><td class="chx_FaveField">Board URL</td><td><input type="text" name="favBoardURL4" style="width:12em"></td>'
+ '<tr><td class="chx_FaveField">Board Name</td><td><input type="text" name="favBoardName5" style="width:12em"></td><td class="chx_FaveField">Board URL</td><td><input type="text" name="favBoardURL5" style="width:12em"></td>'
+ '</table>'
+ '</div>';

$(settingsMenu).find(".chx_FilterField").css("text-align", "right");
$(settingsMenu).find('input').css("max-width", "100%");


var defaultSettings = {
	'precisePages': false,
	'failToCatalogPages': false,
	'catalogLinks': false,
	'revealImageSpoilers': false,
    'GifAnimate': false,
	'reverseImageSearch': true,
	'parseTimestampImage': true,
	'localTime': true,
	'dateFormat':"",
	'mascotUrl':"",
	'keyboardShortcutsEnabled': true,
	'filterDefaultRegex': '',
	'filterDefaultRecursive': true,
	'filterDefaultStubs': false,
	'filterDefault': false,
	'hideNoFilePosts': false,
    'offSiteFaves': false,
    'favBoardName1': '',
    'favBoardURL1': '',
    'favBoardName2': '',
    'favBoardURL2': '',
    'favBoardName3': '',
    'favBoardURL3': '',
    'favBoardName4': '',
    'favBoardURL4': '',
    'favBoardName5': '',
    'favBoardURL5': '',
};

function getSetting(key) {
	if (localStorage.getItem("chx_"+key)) {
		return JSON.parse(localStorage.getItem("chx_"+key));
	} else {
		try {
			var keyMatch = key.match(/filter([A-Z][a-z]*)([A-Z][a-z]*)?/);
			if (!keyMatch) {
				return defaultSettings[key];
			} else {
				return defaultSettings["filterDefault"+(keyMatch.hasOwnProperty(2)?keyMatch[2]:"")];
			}
		} catch(e) {console.error(e);}
	}
}

function setSetting(key, value) {
	localStorage.setItem("chx_"+key, JSON.stringify(value));
}

function refreshSettings() {
	var settingsItems = settingsMenu.getElementsByTagName("input");
	for (var i in settingsItems) {
		if (!settingsItems.hasOwnProperty(i)) {continue;}
		var control = settingsItems[i];
		if (!control.name) {continue;}
		
		switch (control.type) {
			case "checkbox":
				control.checked = getSetting(control.name);
				break;
			default:
				control.value = getSetting(control.name);
				break;
		}
	}
}

function setupControl(control) {
	switch (control.type) {
		case "checkbox":
			$(control).on("change", function () {
				setSetting(this.name, this.checked);
			});
			break;
		default:
			$(control).on("input", function () {
				setSetting(this.name, this.value);
			});
			break;
	}
}

////////////////
//GENERAL FUNCTIONS
////////////////
function isOnCatalog() {
	return window.active_page === "catalog";
}

function isOnThread() {
	return window.active_page === "thread";
}

function printf() { //alexei et al, 3BSD
	var key = arguments[0], cache = sprintf.cache;
	if (!(cache[key] && cache.hasOwnProperty(key))) {
		cache[key] = sprintf.parse(key);
	}
	console.log(sprintf.format.call(null, cache[key], arguments));
}

function getThreadPage(threadId, boardId, cached) { //Pashe, MIT
	if ((!cached) || (cachedPages === null)) {
		$.ajax({
			url: "/" + boardId + "/threads.json",
			async: false,
			dataType: "json",
			success: function (response) {cachedPages = response;}
		});
	}
	
	return calcThreadPage(cachedPages, threadId);
}

function calcThreadPage(pages, threadId) { //Pashe, MIT
	var threadPage = -1;
	var precisePages = getSetting("precisePages");
	
	for (var pageIdx in pages) {
		if (!pages.hasOwnProperty(pageIdx)) {continue;}
		if (threadPage != -1) {break;}
		var threads = pages[pageIdx].threads;
		
		for (var threadIdx in threads) {
			if (!threads.hasOwnProperty(threadIdx)) {continue;}
			if (threadPage != -1) {break;}
			
			if (threads[threadIdx].no == threadId) {
				if (!precisePages) {
					threadPage = pages[pageIdx].page+1;
				} else {
					threadPage = ((pages[pageIdx].page+1)+(threadIdx/threads.length)).toFixed(2);
				}
				break;
			}
		}
	}
	return threadPage;
}

function getThreadLastModified(threadId, boardId, cached) { //Pashe, MIT
	if ((!cached) || (cachedPages === null)) {
		$.ajax({
			url: "/" + boardId + "/threads.json",
			async: false,
			dataType: "json",
			success: function (response) {cachedPages = response;}
		});
	}
	
	return calcThreadLastModified(cachedPages, threadId);
}

function calcThreadLastModified(pages, threadId) { //Pashe, MIT
	var threadLastModified = -1;
	
	for (var pageIdx in pages) {
		if (!pages.hasOwnProperty(pageIdx)) {continue;}
		if (threadLastModified != -1) {break;}
		var threads = pages[pageIdx].threads;
		
		for (var threadIdx in threads) {
			if (!threads.hasOwnProperty(threadIdx)) {continue;}
			if (threadLastModified != -1) {break;}
			
			if (threads[threadIdx].no == threadId) {
				threadLastModified = pages[pageIdx]["threads"][threadIdx]["last_modified"];
				break;
			}
		}
	}
	return threadLastModified;
}

function getThreadPosts() { //Pashe, MIT
	return $(".post").length;
}

function getThreadImages() { //Pashe, MIT
	return $(".post-image").length;
}

function getFileExtension(filename) { //Pashe, MIT
	if (filename.match(/\.([a-z0-9]+)(&loop.*)?$/i) !== null) {
		return filename.match(/\.([a-z0-9]+)(&loop.*)?$/i)[1];
	} else if (filename.match(/https?:\/\/(www\.)?youtube.com/)) {
		return 'Youtube';
	} else {
		return sprintf("unknown: %s", filename);
	}
}

function isImage(fileExtension) { //Pashe, MIT
	return ($.inArray(fileExtension, ["jpg", "jpeg", "gif", "png"]) !== -1);
}

function isVideo(fileExtension) { //Pashe, MIT
	return ($.inArray(fileExtension, ["webm", "mp4"]) !== -1);
}

function updateBoardSettings(response) { //Pashe, MIT
	thisBoardSettings = response;
	
	thisBoardAnonName = thisBoardSettings.anonymous;
	bumpLimit = thisBoardSettings.reply_limit;
}

////////////////
//MENU BAR
////////////////
function updateMenuStats() { //Pashe, MIT
	var nPosts = getThreadPosts(thisThread, thisBoard, false);
	
	$.ajax({
		url: "/settings.php?board="+thisBoard,
		async: true,
		cache: true,
		dataType: "json",
		success: function (response) {
			updateBoardSettings(response);
		}
	});
	
	if (nPosts >= bumpLimit) {nPosts = sprintf('<span style="color:#f00;font-weight:bold;">%d</span>', nPosts);}
	
	$("#chx_menuPosts").html(nPosts);
	$("#chx_menuImages").html(getThreadImages(thisThread, thisBoard, false));
	
	$.ajax({
		url: "/" + thisBoard + "/threads.json",
		async: true,
		dataType: "json",
		success: function (response) {
			cachedPages = response;
			
			var nPage = calcThreadPage(response, thisThread);
			if (nPage < 1) {
				nPage = "<span style='opacity:0.5'>3+</span>";
				
				if (getSetting("failToCatalogPages")) {
					$.ajax({
						url: "/" + thisBoard + "/catalog.html",
						async: false,
						dataType: "html",
						success: function (response) {
							var pageArray = [];
							
							$(response).find("div.thread").each(function() {
								$this = $(this);
								
								var threadId = parseInt($this.children("a").attr("href").match(/([0-9]+).html$/)[1]);
								var page = parseInt($this.find("strong").text().match(/P: ([0-9]+)/)[1]);
								
								pageArray[threadId] = page;
							});
							
							if (pageArray.hasOwnProperty(thisThread)) {nPage = pageArray[thisThread];}
						}
					});
				}
			}
			
			$("#chx_menuPage").html(nPage);
		}
	});
	
}

////////////////
//KEYBOARD SHORTCUTS
////////////////
function reloadPage() { //Pashe, MIT
	if (isOnThread()) {
		window.$('#update_thread').click();
		updateMenuStats();
	} else {
		document.location.reload();
	}
}

function showQR() { //Pashe, MIT
	window.$(window).trigger('cite');
	$("#quick-reply textarea").focus();
}

function toggleExpandAll() { //Tux et al, MIT
	var shrink = window.$('#shrink-all-images a');
	if (shrink.length) {
		shrink.click();
	} else {
		window.$('#expand-all-images a').click();
	}
}

function goToCatalog() { //Pashe, MIT
	if (isOnCatalog()) {return;}
	window.location = sprintf("/%s/catalog.html", thisBoard);
}

////////////////
//REVERSE IMAGE SEARCH
////////////////
var RISProviders = {
	"google": {
		"urlFormat" : "https://www.google.com/searchbyimage?image_url=%s",
		"name"      : "Google"
	},
	"saucenao": {
		"urlFormat" : "https://saucenao.com/search.php?db=999&url=%s",
		"name"      : "SauceNAO"
	},
	"tineye": {
		"urlFormat" : "https://www.tineye.com/search/?url=%s",
		"name"      : "TinEye"
	},
	"karmadecay": {
		"urlFormat" : "http://karmadecay.com/%s",
		"name"      : "Karma Decay"
	},
};

var RISProvidersBoards = {
	"##ALL": ["google", "saucenao", "tineye", "karmadecay"],
};

function addRISLinks(image) { //Pashe, 7185, MIT
	var thisBoardRISProviders = (RISProvidersBoards["##ALL"].concat(RISProvidersBoards[thisBoard]||[]));
	for (var providerIdx in thisBoardRISProviders) {
		providerIdx = thisBoardRISProviders[providerIdx];
		if (!RISProviders.hasOwnProperty(providerIdx)) {continue;}
		var provider = RISProviders[providerIdx];
		
		try {
			var RISUrl;
			if (!image.src.match(/\/spoiler.png$/)) {
				RISUrl = sprintf(provider.urlFormat, image.src);
			} else {
				RISUrl = sprintf(provider.urlFormat, image.parentNode.href);
			}
			
			var RISLink = $('<a class="chx_RISLink"></a>');
			RISLink.attr("href", RISUrl);
			RISLink.attr("title", provider.name);
			RISLink.attr("target", "_blank");
			RISLink.css("font-size", "8pt");
			RISLink.css("margin-left", "2pt");
			RISLink.text(sprintf("[%s]", provider.shortName||provider.name[0].toUpperCase()));
			
			RISLink.appendTo(image.parentNode.parentNode.getElementsByClassName("fileinfo")[0]);
		} catch (e) {}
	}
}

////////////////
//NOTIFICATIONS
////////////////
function notifyReplies() {
	/*
	* taken from https://github.com/ctrlcctrlv/8chan/blob/master/js/show-own-posts.js
	*
	* Released under the MIT license
	* Copyright (c) 2014 Marcin Labanowski <marcin@6irc.net>
	*/
	
	var thread = $(this).parents('[id^="thread_"]').first();
	if (!thread.length) {thread = $(this);}
	
	var ownPosts = JSON.parse(window.localStorage.own_posts || '{}');
	
	$(this).find('div.body:first a:not([rel="nofollow"])').each(function() {
		var postID = $(this).text().match(/^>>(\d+)$/);
		
		if (postID !== null && postID.hasOwnProperty(1)) {
			postID = postID[1];
		} else {
			return;
		}
		
		if (ownPosts[thisBoard] && ownPosts[thisBoard].indexOf(postID) !== -1) {
			var replyPost = $(this).closest("div.post");
			var replyUser = (replyPost.find(".name").text()+replyPost.find(".trip").text());
			var replyBody = replyPost.find(".body").text();
			var replyImage = replyPost.find(".post-image").first().attr('src');
			
			new Notification(replyUser+" replied to your post", {body:replyBody,icon:replyImage});
		}
	});
}

////////////////
//GALLERY
////////////////
var fileExtensionStyles = {
	"jpg":  {"background-color": "#0f0", "color": "#000"}, "jpeg": {"background-color": "#0f0", "color": "#000"},
	"png":  {"background-color": "#00f", "color": "#fff"},
	"webm": {"background-color": "#f00", "color": "#000"}, "mp4": {"background-color": "#a00", "color": "#000"},
	"gif": {"background-color": "#ff0", "color": "#000"},
};

function refreshGalleryImages() { //Pashe, 7185, MIT
	galleryImages = [];
	
	$("img.post-image").each(function() {
		var metadata = $(this).parent("a").siblings(".fileinfo").children(".unimportant").text().replace(/[()]/g, '').split(", ");
		if (!this.src.match(/\/deleted.png$/)) {
			galleryImages.push({
				"thumbnail":  this.src,
				"full":       this.parentNode.href,
				"fileSize":   metadata[0],
				"resolution": metadata[1],
				"aspect":     metadata[2],
				"origName":   metadata[3],
			});
		}
	});
}

function openGallery() { //Pashe, MIT
	refreshGalleryImages();
	
	var galleryHolder = $("<div id='chx_gallery'></div>");
	galleryHolder.appendTo($("body"));
	
	galleryHolder.css({
		"background-color": "rgba(0,0,0,0.8)",
		"overflow":         "auto",
		"z-index":          "101",
		"position":         "fixed",
		"left":             "0",
		"top":              "0",
		"width":            "100%",
		"height":           "100%"
	});
	
	galleryHolder.click(function(e) {
		if(e.target == this) $(this).remove();
	});
	
	for (var i in galleryImages) {
		if (!galleryImages.hasOwnProperty(i)) {continue;}
		var image = galleryImages[i];
		var fileExtension = getFileExtension(image.full);
		
		var thumbHolder = $('<div class="chx_galleryThumbHolder"></div>');
		var thumbLink = $(sprintf('<a class="chx_galleryThumbLink" href="%s"></a>', image.full));
		var thumbImage = $(sprintf('<img class="chx_galleryThumbImage" src="%s" />', image.thumbnail));
		var metadataSpan = $(sprintf('<span class="chx_galleryThumbMetadata">%s</span>', fileExtension));
		
		thumbImage.css({
			"max-height": "128px",
			"max-width":  "128px",
			"margin":     "auto auto auto auto",
			"display":    "block"
		});
		
		thumbHolder.css({
			"padding":    "0pt 0pt 0pt 0pt",
			"height":     "155px",
			"width":      "128px",
			"overflow":   "hidden",
			"float":      "left",
			"text-align": "center",
			"color":      "#fff"
		});
		
		if (fileExtensionStyles.hasOwnProperty(fileExtension)) {
			metadataSpan.css(fileExtensionStyles[fileExtension]).css({"padding": "0pt 5pt 2pt 5pt", "border-radius": "2pt", "font-weight": "bolder"});
		}
		
		thumbImage.appendTo(thumbLink);
		thumbLink.appendTo(thumbHolder);
		metadataSpan.appendTo(thumbHolder);
		thumbHolder.appendTo(galleryHolder);
		
		thumbLink.click(i, function(e) {
			e.preventDefault();
			expandGalleryImage(parseInt(e.data));
		});
	}
}

function closeGallery() { //Pashe, MIT
	if ($("#chx_galleryExpandedImageHolder").length) {
		$("#chx_galleryExpandedImageHolder").remove();
	} else {
		$("#chx_gallery").remove();
	}
}

function toggleGallery() { //Pashe, MIT
	if ($("#chx_gallery").length) {
		closeGallery();
	} else {
		openGallery();
	}
}

function expandGalleryImage(index) { //Pashe, MIT
	galleryImageIndex = index;
	var expandedImage;
	var image = galleryImages[index].full;
	var imageHolder = $('<div id="chx_galleryExpandedImageHolder"></div>');
	var fileExtension = getFileExtension(image);
	
	if (isImage(fileExtension)) {
		expandedImage = $(sprintf('<img class="chx_galleryExpandedImage" src="%s" />', image));
		expandedImage.css({
			"max-height": "98%",
			"max-width":  "100%",
			"margin":     "auto auto auto auto",
			"display":    "block"
		});
	} else if (isVideo(fileExtension)) {
		image = image.match(/player\.php\?v=([^&]*[0-9]+\.[a-z0-9]+).*/i)[1];
		expandedImage = $(sprintf('<video class="chx_galleryExpandedImage" src="%s" autoplay controls>Your browser is shit</video>', image));
		expandedImage.css({
			"max-height": "98%",
			"max-width":  "100%",
			"margin":     "auto auto auto auto",
			"display":    "block"
		});
	} else {
		expandedImage = $(sprintf('<iframe class="chx_galleryExpandedImage" src="%s"></iframe>', image));
		expandedImage.css({
			"max-height": "98%",
			"max-width":  "100%",
			"height":     "98%",
			"width":      "100%",
			"margin":     "auto auto auto auto",
			"display":    "block"
		});
	}
	
	imageHolder.css({
		"background-color": "rgba(0,0,0,0.8)",
		"overflow":         "auto",
		"z-index":          "102",
		"position":         "fixed",
		"left":             "0",
		"top":              "0",
		"width":            "100%",
		"height":           "100%"
	});
	
	imageHolder.appendTo($("body"));
	expandedImage.appendTo(imageHolder);
	imageHolder.click(function(e) {
		if(e.target == this) $(this).remove();
	});
}

function jogExpandedGalleryImage(steps) {
	if ($("#chx_galleryExpandedImageHolder").length && galleryImages.hasOwnProperty(galleryImageIndex+steps)) {
		$("#chx_galleryExpandedImageHolder").remove();
		expandGalleryImage(galleryImageIndex+steps);
	}
}

////////////////
//FILTERS
////////////////
function hidePost(post, recursive, stubs) { //Pashe, MIT
	if (!stubs) {
		post.jqObj.hide();
		post.jqObj.next("br").remove();
	} else {
		window.$("#reply_"+post.no).find(".post-hide-link").trigger("click");
	}
	
	if (recursive && post.ment.length) {
		for (var i in post.ment) {
			if (!post.ment.hasOwnProperty(i)) {continue;}
			
			if (!stubs) {
				$("#reply_"+post.ment[i]).hide();
				$("#reply_"+post.ment[i]).next("br").remove();
			} else {
				window.$("#reply_"+post.ment[i]).find(".post-hide-link").trigger("click");
			}
		}
	}
}

function runFilter() { //Pashe, MIT
	var $this = $(this);
	
	var thisPost = {
		trip:  $this.find("span.trip").text(),
		name:  $this.find("span.name").text(),
		body:  $this.find("div.body").text(),
		email: $this.find("a.email").attr("href"),
		sub:   $this.find("span.subject").text(),
		flag:  $this.find("img.flag").attr("title"),

		cap:   $this.find("span.capcode").text(),
		ment:  $this.find(".mentioned").text().length?$this.find(".mentioned").text().replace(/>>/g, "").replace(/ $/, "").split(" "):[],
		
		// date:  $this.find("time").attr("datetime"),
		no:    $this.find("a.post_no").first().next().text(),
		
		jqObj: $this,
		// stdObj: this,
	};


	
	if (isMod) {return;}
	
	if (getSetting("hideNoFilePosts") && (!$this.find("div.file").length)) {
		hidePost(thisPost, false, false);
		return;
	}
	
	var filterTypes = {
		trip: "Trips",
		name: "Names",
		body: "Body",
		email: "Email",
		sub: "Subject",
		flag: "Flag",
	};
	
	for (var i in filterTypes) {
		if (!filterTypes.hasOwnProperty(i) || !thisPost[i]) {continue;}
		
		var filterType = filterTypes[i];
		var filterField = thisPost[i];
		
		var filterHideAll = getSetting(sprintf("filter%s", filterType));
		var filterRecursive = getSetting(sprintf("filter%sRecursive", filterType));
		var filterStubs = getSetting(sprintf("filter%sStubs", filterType));
		var filterRegex = getSetting(sprintf("filter%sRegex", filterType));
		
		if ((filterHideAll && filterType !== "Names") && filterField.length) {
			hidePost(thisPost, filterRecursive, filterStubs);
		} else if ((thisBoardAnonName !== undefined) && (filterHideAll && filterType === "Names") && (filterField !== thisBoardAnonName)) {
			hidePost(thisPost, filterRecursive, filterStubs);
		} else if (filterRegex) {
			filterRegex = filterRegex.split('````');
			for (var i in filterRegex) {
				var thisRegex;
				var thisRegexStr = filterRegex[i].split("```")[0];
				
				if (filterRegex[i].split("```").length > 1) {
					var thisRegexBoards = filterRegex[i].split("```")[1].split(",");
					for (var i in thisRegexBoards) {
						if (thisBoard.match(RegExp(thisRegexBoards[i])) !== null) {
							thisRegex = new RegExp(thisRegexStr);
							if (filterField.match(thisRegex)) {hidePost(thisPost, filterRecursive, filterStubs);}
						}
					}
				} else {
					thisRegex = new RegExp(thisRegexStr);
					if (filterField.match(thisRegex)) {hidePost(thisPost, filterRecursive, filterStubs);}
				}
			}
		}
	}
}

////////////////
//INIT FUNCTIONS
////////////////
function initSettings() {
	refreshSettings();
	var settingsItems = settingsMenu.getElementsByTagName("input");
	for (var i in settingsItems) {
		if (!settingsItems.hasOwnProperty(i)) {continue;}
		setupControl(settingsItems[i]);
	}
}

function initMenu() { //Pashe and vol4, MIT
	var menu = window.document.getElementsByClassName("boardlist")[0];
	var $menu = $(menu);

    if (getSetting('offSiteFaves')) {
        var fburl1 = (getSetting('favBoardURL1'));
        var fbname1 = (getSetting('favBoardName1'));
        var fburl2 = (getSetting('favBoardURL2'));
        var fbname2 = (getSetting('favBoardName2'));
        var fburl3 = (getSetting('favBoardURL3'));
        var fbname3 = (getSetting('favBoardName3'));
        var fburl4 = (getSetting('favBoardURL4'));
        var fbname4 = (getSetting('favBoardName4'));
        var fburl5 = (getSetting('favBoardURL5'));
        var fbname5 = (getSetting('favBoardName5'));
        var osf = $('<span class="sub" data-description="4"> [ <a href="' + fburl1 + '" title="Favorite 1">' + fbname1 + '</a> / <a href="' + fburl2 + '" title="Favorite 1">' + fbname2 + '</a> / <a href="' + fburl3 + '" title="Favorite 1">' + fbname3 + '</a> / <a href="' + fburl4 + '" title="Favorite 1">' + fbname4 + '</a> / <a href="' + fburl5 + '" title="Favorite 1">' + fbname5 + '</a> ]</span>');
        osf.appendTo(menu);
    }

	if (getSetting('catalogLinks')) {
        	$('.favorite-boards a').each(function () {
			$(this).attr("href", $(this).attr("href")+"/catalog.html");
		});
	}

	if (isOnThread()) {
		$('#update_secs').remove();

		var updateNode = $("<span></span>");
		updateNode.attr("id", "update_secs");
		updateNode.css("font-family", "'Source Code Pro', monospace");
		updateNode.css("padding-left", "3pt");
		updateNode.attr("title","Update thread");
		updateNode.click(function() {$('#update_thread').click();});
		updateNode.appendTo($menu);

		var statsNode = $("<span></span>");
		statsNode.html(
			 '<span title="Posts" id="chx_menuPosts">---</span> / '
			+'<span title="Images" id="chx_menuImages">---</span> / '
			+'<span title="Page" id="chx_menuPage">---</span>'
		);
		statsNode.attr("id", "menuStats");
		statsNode.css("padding-left", "3pt");
		statsNode.appendTo($menu);

		updateMenuStats();

		var galleryButton = $('<a href="javascript:void(0)" title="Gallery"><i class="fa fa-th-large chx_menuGalleryButton"></i></a>');
		var menuButtonHolder = $('span.sub[data-description=0]').first();

		menuButtonHolder.html(function() {return this.innerHTML.replace("]", " / ");});

		galleryButton.appendTo(menuButtonHolder);
		menuButtonHolder.html(function() {return this.innerHTML + " ]";});

		$(".chx_menuGalleryButton").on("click", toggleGallery); //galleryButton isn't the same as $(".chx_menuGalleryButton") after appending the ] to menuButtonHolder.
	}
}

function initRevealImageSpoilers() { //Tux et al, MIT
	if (!getSetting('revealImageSpoilers')) {return;}
	$('.post-image').each(function() {
		var pic;
		if ($(this)[0].tagName == "IMG") {
			pic = $(this);
		} else if ($(this)[0].tagName == "CANVAS") {
			pic = $(this).next();
		} else {return;}

		var picUrl = pic.attr("src");
		if (picUrl.indexOf('spoiler.png') >= 0) {
			pic.attr("src", $(this).parent().attr("href"));
			pic.addClass("chx_unspoileredImage");

			pic.css({
				"width":      "auto",
				"height":     "auto",
				"max-width":  "255px",
				"max-height": "255px",
			});
		}
	});
}

function initGifAnimate() { //vol4, based on an anonymous contribution, MIT

    if (!getSetting('GifAnimate')) {return;}
    $('document').ready(function () {
        var animateGif = function () {
            if ($(this).children('img.post-image').attr('src') != '/static/spoiler.png')
                $(this).children('img.post-image').attr('src', $(this).attr('href'));
        }

        $('div.file').children('a[href*=".gif"]').each(animateGif);
        $(document).on('new_post', function (e, post) {
            $(post).find('div.file').children('a[href*=".gif"]').each(animateGif);
        });
    });
}

function initKeyboardShortcuts() { //Pashe, heavily influenced by Tux et al, MIT
	if (!getSetting("keyboardShortcutsEnabled")) {return;}
	
	$(document).keydown(function(e) {
		if (e.keyCode == 27) {
			$('#quick-reply').remove();
			closeGallery();
		}
		
		if (e.target.nodeName == "INPUT" || e.target.nodeName == "TEXTAREA") {return;}
		if ((!e.ctrlKey) && (!e.metaKey)) {
			switch (e.keyCode) {
				case 82:
					reloadPage();
					break;
				case 81:
					showQR();
					e.preventDefault();
					break;
				case 71:
					toggleGallery();
					break;
				case 69:
					toggleExpandAll();
					break;
				case 67:
					goToCatalog();
					break;
				case 39:
					jogExpandedGalleryImage(+1);
					break;
				case 37:
					jogExpandedGalleryImage(-1);
					break;
			}
		}
	});
}

function initCatalog() { //Pashe, MIT
	if (!isOnCatalog()) {return;}
	
	//addCatalogPages
	if (getSetting("precisePages")) { 
		$(".thread").each(function (e, ele) {
			var threadId = $(ele).html().match(/<a href="[^0-9]*([0-9]+).html?">/)[1];
			var threadPage = getThreadPage(threadId, thisBoard, true);
			
			if (threadPage < 1) {return;}
			
			$(ele).find("strong").first().html(function(e, html) {
				return html.replace(/P: [0-9]+/, ("P: " + threadPage));
			});
		});
	};
	
	//Last Modified
	$(".thread").each(function (e, ele) {
			var $this = $(this);
			var threadId = $this.html().match(/<a href="[^0-9]*([0-9]+).html?">/)[1];
			var threadPage = getThreadPage(threadId, thisBoard, true);
			
			var timestamp = getThreadLastModified(threadId, thisBoard, true);
			if (timestamp == -1) {return;}
			var lmDate  = new Date(timestamp * 1000);
			
			var lmTimeElement = $('<span class="chx_catalogLMTStamp"></span>');
			lmTimeElement.attr("title", lmDate.toGMTString());
			lmTimeElement.attr("data-timestamp", timestamp);
			lmTimeElement.attr("data-isotime", lmDate.toISOString());
			lmTimeElement.html("<br>" + $.timeago(timestamp * 1000));
			lmTimeElement.appendTo($this.find("strong").first());
		});

	//addCatalogNullImagePlaceholders
	$("img[src=''], img[src='/static/no-file.png']").attr("src", "data:image/svg+xml;base64,PHN2ZyB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgaGVpZ2h0PSIyMDAiIHdpZHRoPSIyMDAiIHZlcnNpb249IjEuMSI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCwtODYwKSI+PHRleHQgc3R5bGU9ImxldHRlci1zcGFjaW5nOjBweDt0ZXh0LWFuY2hvcjptaWRkbGU7d29yZC1zcGFjaW5nOjBweDt0ZXh0LWFsaWduOmNlbnRlcjsiIHhtbDpzcGFjZT0icHJlc2VydmUiIGZvbnQtc2l6ZT0iNjRweCIgeT0iOTMwIiB4PSI5NSIgZm9udC1mYW1pbHk9IidBZG9iZSBDbGVhbiBVSScsIHNhbnMtc2VyaWYiIGxpbmUtaGVpZ2h0PSIxMjUlIiBmaWxsPSIjMDAwMDAwIj48dHNwYW4geD0iOTUiIHk9IjkyOSI+Tm88L3RzcGFuPjx0c3BhbiB4PSI5NSIgeT0iMTAxMCI+SW1hZ2U8L3RzcGFuPjwvdGV4dD48L2c+PC9zdmc+");
}

function initRISLinks() { //Pashe, 7185, MIT
	if (!getSetting("reverseImageSearch")) {return;}
	$("img.post-image").each(function() {addRISLinks(this);});
}

function initParseTimestampImage() { //Pashe, MIT
	//if (!getSetting("parseTimestampImage")) {break;}
	try {
		var minTimestamp = new Date(1985,1).valueOf();
		var maxTimestamp = Date.now()+(24*60*60*1000);
		
		$("p.fileinfo > span.unimportant > a:link").each(function() {
			var $this = $(this);
			var filename = $this.text();
			
			if (!filename.match(/^([0-9]{9,13})[^a-zA-Z0-9]?.*$/)) {return;}
			var timestamp = parseInt(filename.match(/^([0-9]{9,13})[^a-zA-Z0-9]?.*$/)[1]);
			
			if (timestamp < minTimestamp) {timestamp *= 1000;}
			if ((timestamp < minTimestamp) || (timestamp > maxTimestamp)) {return;}
			
			var fileDate = new Date(timestamp);
			
			var fileTimeElement = $('<span class="chx_PTIStamp"></span>');
			fileTimeElement.attr("title", fileDate.toGMTString());
			fileTimeElement.attr("data-timestamp", timestamp);
			fileTimeElement.attr("data-isotime", fileDate.toISOString());
			fileTimeElement.text(", " + $.timeago(timestamp) + ")");
			fileTimeElement.appendTo($this.parent());
			
			$this.parent().html(function(e, html) {
				return html.replace(")", "");
			});
		});
	} catch (e) {}
}

function initNotifications() {
	Notification.requestPermission();
}

function initMascot() { //Pashe, based on an anonymous contribution, MIT
	if (!getSetting("mascotUrl")) {return;}
	
	var mascotUrls = getSetting("mascotUrl").split("|");
	var mascotUrl = mascotUrls[Math.floor((Math.random()*mascotUrls.length))];
	
	$("head").append(
		"<style>" +
		"	form[name=postcontrols] {"+
		"		margin-right: 22%;"+
		"	}"+
		"	div.delete{"+
		"		padding-right: 6%;"+
		"	}"+
		"	div.styles {"+
		"		float: left;"+
		"	}"+
		"	div#chx_mascot img {"+
		"		display: block;"+
		"		position: fixed;"+
		"		bottom: 0pt;"+
		"		right: 0pt;"+
		"		left: auto;"+
		"		max-width: 25%;"+
		"		max-height: 100%;"+
		"		opacity: 0.8;"+
		"		z-index: -100;"+
		"		pointer-events: none;"+
		"	}"+
		"</style>"
	);
	
	var mascotHolder = $('<div id="chx_mascot"></div>');
	var mascotImage = $('<img></img>');
	var hostElement = $("body").first();
	
	mascotImage.attr("src", mascotUrl);
	
	mascotImage.appendTo(mascotHolder);
	mascotHolder.appendTo(hostElement);
	
	if (isOnCatalog()) {mascotImage.css("z-index", "-100");}
}

function initDefaultSettings() { //Pashe, MIT
	if (window.localStorage.color_ids === undefined) window.localStorage.color_ids = true;
	if (window.localStorage.videohover === undefined) window.localStorage.videohover = true;
	if (window.localStorage.catalogImageHover === undefined) window.localStorage.catalogImageHover = true;
	if (window.localStorage.imageHover === undefined) window.localStorage.imageHover = true;
}


function initFlagIcons() { //Anonymous contribution, MIT
	if (!$("#user_flag").length) {return;}
	
	var board = window.location.pathname.replace(/^\/([^/]+).*?$/, "$1");
	var custom_flag_url = window.location.origin + '/static/custom-flags/' + board + '/';
	var dropdown_options = document.getElementById('user_flag').childNodes;

	if (!dropdown_options || !dropdown_options.length) return;

	for (var i = 0; i < dropdown_options.length; i++) {
			var opt = dropdown_options[i];
			opt.style.paddingLeft = '20px';
			if (opt.value)
					opt.style.background = 'no-repeat left center url(' + custom_flag_url + opt.value + '.png)';
	}
}

function initFormattedTime() { //Pashe, MIT
	if (!getSetting("dateFormat")) {return;}
	
	$("time").text(function() {
		//%Y-%m-%d %H:%M:%S is nice
		
		var $this = $(this);
		
		var thisDate = new Date($this.attr("datetime"));
		
		if (getSetting("localTime")) {
			return strftime(getSetting("dateFormat"), thisDate);
		} else {
			return strftimeUTC(getSetting("dateFormat"), thisDate);
		}
	});
}

function initFilter() { //Pashe, MIT	
	$(".reply").each(runFilter);
	
	$.ajax({
		url: "/settings.php?board="+thisBoard,
		async: true,
		cache: true,
		dataType: "json",
		success: function (response) {
			updateBoardSettings(response);
			
			$(".reply").each(runFilter);
		}
	});
}

////////////////
//INIT CALLS
////////////////
$(window.document).ready(function() { try {
	initSettings();
	initDefaultSettings();
	initMenu();
	initCatalog();
	initFilter();
	initFormattedTime();
	initMascot();
	initRevealImageSpoilers();
    initGifAnimate();
	initRISLinks();
	initParseTimestampImage();
	initNotifications();
	initFlagIcons();
	initKeyboardShortcuts();
} catch(e) {chxErrorHandler(e, "ready");}});

////////////////
//EVENT HANDLER FUNCTIONS
////////////////
function onNewPostRISLinks(post) { //Pashe, 7185, MIT
	$("#"+$(post).attr("id")+" img.post-image").each(function() {addRISLinks(this);}); 
}

function onNewPostNotifications(post) {
	var $post = $(post);
	if ($post.is('div.post.reply')) {
		$post.each(notifyReplies);
	} else {
		$post.find('div.post.reply').each(notifyReplies);
	}
}

function onNewPostFormattedTime() {
	initFormattedTime();
}

function onNewPostFilter(post) { //Pashe, MIT
	$(post).each(runFilter);
}

function intervalMenu() {
	updateMenuStats();
}

////////////////
//EVENT HANDLERS
////////////////
if (window.jQuery) {
	window.$(document).on('new_post', function (e, post) { try {
		onNewPostRISLinks(post);
		onNewPostNotifications(post);
		onNewPostFormattedTime();
		onNewPostFilter(post);
	} catch(e) {chxErrorHandler(e, "newpost");}});

	setInterval(intervalMenu, (1.5*60*1000));
}
} catch(e) {chxErrorHandler(e, "global");}
