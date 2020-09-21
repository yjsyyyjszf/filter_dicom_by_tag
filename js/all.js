
function populateStudyInstanceUIDs() {
    // pull the list of projects for the current user
    jQuery.getJSON('php/getProjects.php', function(data) {
	jQuery('#project').children().remove();
	for (var i = 0; i < data.length; i++) {
	    jQuery("#project").append("<option value=\"" + data[i]['record_id'] + "\">" + data[i]['record_id'] + "</option>");
	}
	jQuery('select').selectpicker('refresh');
    });
}
//var lastQueryID = "";

function appendSeries(StudyInstanceUID, SeriesInstanceUID, data) {
    // do something
    var entry = jQuery('#content #' + StudyInstanceUID);
    if (!entry.length > 0) {
	jQuery('#content').append("<div class='Study' id='" + StudyInstanceUID + "'><div class='bottom-back'><span></span></div><div class='bottom-back-event'><span></span></div></div>");
	jQuery('#content-selected').append("<div class='Study' id='" + StudyInstanceUID + "-s'></div>");
	// image series to appear before we can fix the alignment
    }
    //var entry2 = jQuery('#content-selected #' + StudyInstanceUID + "-s");
    //if (!entry2.length > 0) {
    //}
	
    var text_node = document.createTextNode(data);
    var dd = parseDICOMStruct( jQuery(text_node).text() );

    
    if (typeof dd['0008'] !== 'undefined' && typeof  dd['0008']['0090'] !== 'undefined')
	jQuery('#' + StudyInstanceUID).find('div.bottom-back-event span').text(dd['0008']['0090']);
    
    if (typeof dd['0010'] !== 'undefined' && typeof  dd['0010']['0010'] !== 'undefined')
	jQuery('#' + StudyInstanceUID).find('div.bottom-back span').text(dd['0010']['0010']);
    
    var SeriesNumber = "";
    if (typeof dd['0020'] !== 'undefined' && typeof  dd['0020']['0011'] !== 'undefined')
	SeriesNumber = dd['0020']['0011'];    

    var modality = "--";
    if (typeof dd['0008'] !== 'undefined' && typeof  dd['0008']['0060'] !== 'undefined')
	modality = dd['0008']['0060'];

    var numImages = "";
    if (typeof dd['0020'] !== 'undefined' && typeof  dd['0020']['1209'] !== 'undefined')
	numImages = dd['0020']['1209'];

    var SeriesDescription = "";
    if (typeof dd['0008'] !== 'undefined' && typeof  dd['0008']['103e'] !== 'undefined')
	SeriesDescription = dd['0008']['103e'];

    // We should add the series based on the SeriesNumber to get the sorting right
    var t = '<div class="Series" id="' + SeriesInstanceUID + '" data="' + jQuery(text_node).text() + '" title="Mouse-click to see full tags in console">' +
	'<div class="modality">' + modality + '</div>' +
	'<div class="numImages">' + numImages + '</div>' +
	'<div class="SeriesNumber">' + SeriesNumber + '</div>' +
	'<div class="SeriesDescription">' + SeriesDescription + '</div>' +
	'<img src="" /></div>';
    var els = jQuery('#' + StudyInstanceUID).find('div.Series');
    if (els.length == 0) {
	jQuery('#' + StudyInstanceUID).append(t);
    } else {
	var inserted = false;
	for (var i = 0; i < els.length; i++) {
	    var sn = jQuery(els[i]).find("div.SeriesNumber").text();
	    if (parseInt(SeriesNumber) < parseInt(sn)) {
		jQuery(t).insertBefore(jQuery(els[i]));
		inserted = true;
		break;
	    }
	}
	if (!inserted) {
	     jQuery('#' + StudyInstanceUID).append(t);
	}
    }
/*    jQuery('#' + StudyInstanceUID).append('<div class="Series" id="' + SeriesInstanceUID + '" data="' + jQuery(text_node).text() + '" title="Mouse-click to see full tags in console">' +
					  '<div class="modality">' + modality + '</div>' +
					  '<div class="numImages">' + numImages + '</div>' +
					  '<div class="SeriesNumber">' + SeriesNumber + '</div>' +
					  '<div class="SeriesDescription">' + SeriesDescription + '</div>' +
					  '<img src="" /></div>');
*/
    
    //jQuery('#' + StudyInstanceUID + '-s').append('<div class="Series" id="' + SeriesInstanceUID + '-s" data="' + jQuery(text_node).text() + '" title="' + jQuery(text_node).text() + '"></div>');
    //alignRight(); // this will not work for the last of the fields... there we need to wait for all the
}

function parseDICOMStruct( txt ) {
    var r = {};
    // build a structure by reading the DICOM information line by line
    if (typeof txt === 'undefined' || txt == null) {
	return r;
    }
    var ar = txt.split("\n");
    for (line in ar) {
	//console.log("line is: " + ar[line]);
	const regex = /.*\(([0-9a-f]+),([0-9a-f]+)\) [A-Z][A-Z] \[([^\]]*)\].*/;
	const found = ar[line].match(regex);
	if (typeof found !== 'undefined' && found !== null && found.length > 2) {
	    //console.log("found tag " + found[1] + "," + found[2] + " with value: " + found[3]);
	    if (typeof r[found[1]] === 'undefined') {
		r[found[1]] = {};
	    }
	    r[found[1]][found[2]] = found[3];
	}
    }
    return r;
}

// classify
function sendToClassifier() {
    // ok, we need the structure for all found entries and we need to add the classification
    // by study - so we need to select all that we have and classify all that we need in other
    // series
    var data = { "train": [], "predict": [] }; // we will need training and prediction (request prediction back - one-shot learning)

    jQuery('#content').find('div.Series').each(function(a,b) {
	var type = "unknown";
	if (jQuery(b).hasClass('highlighted-human-a') || jQuery(b).hasClass('highlighted-human-b')) {
	    // needs to go into training set - positive negative examples
	    if (jQuery(b).hasClass('highlighted-human-a'))
		type = "a";
	    else
		type = "b";
	}
	if (type != "unknown")
	    data['train'].push({class: type, study: jQuery(this).parent().attr('id'), series: jQuery(this).attr('id'), data: parseDICOMStruct(jQuery(this).attr('data')) });
	else
	    data['predict'].push({ study: jQuery(this).parent().attr('id'), series: jQuery(this).attr('id'), data: parseDICOMStruct(jQuery(this).attr('data')) });
    });
    // before we send the query out we should remove our current results
    jQuery('#content-selected div.Series').remove();
    jQuery('#content div.Series.a').removeClass('a');
    jQuery('#content div.Series.b').removeClass('b');
    
    // call the server prediction
    // TODO: we should only allow the last classification to continue
    jQuery.post('php/ai01.php', { data: JSON.stringify(data) }, function(data) {
	// remove again in case we have more than one mouse-click
	// TODO: Any way to cancel the previous iteration? Delayed executation?
	jQuery('#content-selected div.Series').remove();
	jQuery('#content div.Series.a').removeClass('a');
	jQuery('#content div.Series.b').removeClass('b');
	

	console.log("Got some data back from the model: " + JSON.stringify(data));
	jQuery('#processing-time').text(data['processing_time'].toFixed(2) + "sec, training acc. = " + data['accuracy_percent'].toFixed(0) + "%");
	if (typeof data['tree_image'] !== 'undefined') {
	    jQuery('#tree-space').children().remove();
	    jQuery('#tree-space').append("<img style='width: 100%;' src='php/data/" + data['tree_image'] + "'/>");
	    jQuery('#tree-space').append("<div><center>" + data['rules'] + "</center></div>");
	}
	// lets highlight the class for each
	// lets reset all series first (remove a, b classes)
	jQuery('#content div.a').removeClass('a');
	jQuery('#content div.b').removeClass('b');
	for ( var i = 0; i < data.class.length; i++) {
	    var st = data.study[i];
	    var se = "div#" + data.series[i];
	    var c = data.class[i];
	    jQuery(se.replace(".","\\\\.")).removeClass('a').removeClass('b').addClass(c);
	}
	if (typeof data['splits'] == 'string') {
	    data['splits'] = [ data['splits'] ];
	}
	if (typeof data['splits'] !== 'undefined') {
	    var elems = data['splits'];
	    var erg = "";
	    for (var i = 0; i < elems.length; i++) {
		var elem = elems[i];
		var el = elem.replace(/^g/, "").replace(".","").toUpperCase();
		var nam = "";
		if (typeof dicom_dict[el] !== 'undefined') {
		    nam = dicom_dict[el];
		} else {
		    nam = elem;
		}
		// what is the importance?
		var weight = "";
		if (data['splits_weight'].length > i) {
		    weight = " (" + Number.parseFloat(data['splits_weight'][i]).toFixed(2) + ")";
		}
		if (i < elems.length-1) {
		    erg = erg + nam + weight + ", ";
		} else {
		    erg = erg + nam + weight;
		}
	    }
	    jQuery('#chat').val(erg);
	    jQuery('#chat').effect('highlight');
	    
	} else
	    jQuery('#chat').val("no splits found for this run...");
	// now map all the found series to content-selected
	//jQuery('#content-selected').find('div.Series').remove();	
	jQuery('#content div.a,div.highlighted-human-a').each(function(a,b) {
	    var study = jQuery(b).parent().attr('id');
	    var series = jQuery(b).attr('id');
	    jQuery('#content-selected').find('div#' + study + "-s").append('<div class="Series" id="' + series + '-s" data="' + jQuery(b).attr('data') + '">' +
									   '<div class="modality">' + jQuery(b).find('div.modality').text() + '</div>' +
									   '<div class="numImages">' + jQuery(b).find('div.numImages').text() + '</div>' +
									   '<div class="SeriesNumber">' + jQuery(b).find('div.SeriesNumber').text() + '</div>' +
									   '<div class="SeriesDescription">' + jQuery(b).find('div.SeriesDescription').text() + '</div>' +
									   '<img src="' + jQuery(b).find('img').attr('src') + '" style="margin-left: ' +  jQuery(b).find('img').css('margin-left') + '; margin-top: ' +  jQuery(b).find('img').css('margin-top') + ';"/>' +
									   '</div>');
	});
	var numParticipants = [...new Set(jQuery.map(jQuery('#content div.bottom-back span'), function(a,i) { return jQuery(a).text(); }))].length;
	var numSelectedStudies = 0;
	jQuery.map(jQuery('#content-selected div.Study'), function(value, i) {
	    if (jQuery(value).find('div.Series').length > 0)
		numSelectedStudies++;
	});
	jQuery('span.stats-general').text(" (" + numParticipants + " participants, "
					  + jQuery('#content div.Series').length + " imaging series in "
					  + jQuery('#content div.Study').length + " imaging studies)");
	jQuery('span.stats').text(" " + jQuery('#content-selected div.Series').length + " series in " + numSelectedStudies + " studies");
	//jQuery('#message-text').text("Classification of " + data['class'].length + " image series resulted in " + jQuery('#content div.a').length + " matches.");
    }, "json").fail(function() {
	console.log("we did not get something back ... ");
    });
    
}

function addThumbnails() {
    jQuery.get('php/data/' + lastQueryID + '/imageIndex.txt', function(data) {
	// the order in this file indicates the order of images in the montage
	var l = data.split("\n").map(function(a) {
	    return a.split("/").pop().split(".")[0];
	});
	var imageURL = "/applications/Filter/php/data/" + lastQueryID + "/imageMontage.jpg?_=" + Math.random();
	l.forEach(function(value, idx) {
	    if (value.length > 0) {
		// given the idx what is the image we look for?
		// each image has a with of 6 * 64 (image size is 64x64)
		// given the idx value we end up with a location in the image of
		// top left corner for this image is:
		var y = Math.floor(idx / 6);
		var x = idx - (y*6);
		jQuery('#series_'+value+' img').attr('src', imageURL);
		jQuery('#series_'+value+' img').css('margin-left', -x*32);
		jQuery('#series_'+value+' img').css('margin-top', -y*32);
		//jQuery('#series_'+value+' img').attr('bla', idx);
	    }
	});
    });
}

// see if we have an update on this query
function checkQueryID() {
    jQuery('#learning-section').show();
    jQuery('div.progress').show();
    
    jQuery.getJSON('php/queryID.php', { 'ID': lastQueryID }, function(data) {
	var howmany = jQuery('#results').children().length; // how many series
	jQuery('#content').show();
	// tables can be large, we should only add new rows, so no remove first
	jQuery('#content').children().remove();
	jQuery('#content-selected').children().remove();
	var table_counter = 1; // if we find a new row insert, else keep
	// add all rows at once (small speed up)
	var rowstxt = "";
	for (var i = 0; i < Object.keys(data).length; i++) {
	    var key = Object.keys(data)[i];
	    for (var j = 0; j < Object.keys(data[key]).length; j++) {
		var key2 = Object.keys(data[key])[j];
		appendSeries('study_' + key, ('series_' + key2).replace(".cache",""), data[key][key2].join("\n"));
	    }
	    table_counter++;
	}
	jQuery('#results').append(rowstxt);
	alignRight();
	
	var d = new Date();
	var h = (data.length - howmany);
	jQuery('#message').html("(updated on " + d.toISOString() + " - " + h + (h!=1?" new entries)":" new entry)"));
	//addThumbnails();
	if (!stopQuery) {
            setTimeout(checkQueryID, 2000);
	} else {
	    // if we don't have data alert
	    if (data.length == 0) {
		alert("No data could be copied from PACS.");
	    }	    
	    jQuery('div.progress').hide();	    
	    addThumbnails();
	}
    }).fail(function(xhr, error, StatusMessage) {
	console.log("query failed.. no JSON produced...");
	// maybe it failed only once?
        setTimeout(checkQueryID, 2000);
    });
}

var stopQuery = false;
var counter = 0;
function checkFinished() {
    jQuery.getJSON('php/data/'+lastQueryID+'/info.json', function(data) {
	if (typeof data['enddate'] != 'undefined') {
	    jQuery('#finished').addClass('finished');
	    stopQuery = true;
	    jQuery('#message-text').text();
	    //jQuery('div.progress').hide();
	    return;
	} else {
	    jQuery('#finished').removeClass('finished');
	}
	// update the progress bar length
	if (typeof data['num_participant'] != 'undefined' && typeof data['total_num_participants'] != 'undefined') {
	    var t = Math.floor((data['num_participant'] / data['total_num_participants']) * 100);
	    jQuery('#finished').attr('aria-valuenow', t);
	    jQuery('#finished').css('width', t + "%");
	    counter++;
	    var dots = ".";
	    for (var i = 0; i < counter % 3; i++) {
		dots += ".";
	    }
	    
	    jQuery('#message-text').text("Move data from PACS and scan for tags" + dots + " (" + data['num_participant'] + " of " + data['total_num_participants'] + " DICOM studies)");
	}
	setTimeout(checkFinished, 6000);
    });
}

function alignRight() {
    jQuery('#content div.Study').each(function(idx, value) {
	// console.log("we have row number: " + (idx % 3));
	var height = jQuery(value).css('height');
	var id = jQuery(value).attr('id');
	var height2 = jQuery('#' + id + '-s').css('height');
	//if (parseInt(height) < parseInt(height2)) {
	//    height = height2;
	//}
	jQuery('#' + id + '-s').css('height', height);
    });
    // we should also sort the series by SeriesNumber - but this inserts them twice with the same ID
    /*jQuery('#content div.Study').each(function(idx, value) {
	jQuery(value).find('div.Series').sort(function(a,b) {
	    return jQuery(a).find("div.SeriesNumber").text() - jQuery(b).find("div.SeriesNumber").text();
	}).appendTo(value);
    }); */
}

var lastQueryID = "";
var dicom_dict = {};
jQuery(document).ready(function() {

    jQuery('#processing-time').on('click', function() {
	// display the decision tree as a graphic
	jQuery('#tree-modal').modal('show');
    });
    
    jQuery('#download-selected').on('click', function() {
	// download a spreadsheet with the series instance uid's from research PACS
	var content = "SeriesInstanceUID,StudyInstanceUID\n";
	jQuery('#content-selected').find('div.Series').each(function(i,a) {
	    var SeriesInstanceUID = jQuery(a).attr('id').replace("-s","").replace("series_","");
	    var StudyInstanceUID = jQuery(a).parent().attr('id').replace("-s","").replace("study_","");
	    content = content + SeriesInstanceUID + "," + StudyInstanceUID + "\n";
	});
	
	var csv = "data:text/csv;charset=utf-8," + content;
	var encodeUri = encodeURI(csv);
	var link = document.createElement("a");
	link.setAttribute("href", encodeUri);
	link.setAttribute("download", "selection.csv");
	document.body.appendChild(link);
	link.click();
    });
    
    // get the DICOM dictionary
    jQuery.getJSON('js/StandardDICOMElements.json', function(data) {
	dicom_dict = data;
    });    

    jQuery(window).resize(function() {
	alignRight();
    });
    
    if (typeof calledQueryID != 'undefined') {
	lastQueryID = calledQueryID;
	setTimeout(function() {
	    setTimeout(checkQueryID, 2000);
	    setTimeout(checkFinished, 10000);
	}, 10);
    }
    
    populateStudyInstanceUIDs();
    jQuery('#project').on('change', function() {
	console.log("change project to " + jQuery(this).val());
        jQuery('#finished').removeClass('finished');
	jQuery('#chat').val("");
	jQuery('#message-text').text("");
	jQuery('#processing-time').text("");
	jQuery('span.stats').text("");
	jQuery('span.stats-general').text("");
	
	var project = jQuery(this).val();
	var allowCache = "0";
	if (jQuery('#allowCachedVersion').is(':checked'))
	    allowCache = "1";
	jQuery.getJSON('php/pullTags.php', { 'project': project, 'allowCache': allowCache }, function(data) {
	    lastQueryID = data.ID;
	    stopQuery = false;
	    setTimeout(checkQueryID, 2000);
	    setTimeout(checkFinished, 10000);
	});
    });

    // for touch devices we do a touch for click and a taphold for shift-click (right mouse)
    jQuery('#content').on('touch', 'div.Series', function(e) {
	jQuery(this).trigger('click');
    });
    
    jQuery('#content').on('taphold', 'div.Series', function(e) {
	var shiftClick = jQuery.Event('click');
	shiftClick.shiftKey = true;
	jQuery(this).trigger(shiftClick);
    });
    
    jQuery('#content').on('click', 'div.Series', function(e) {
	console.log(jQuery(this).attr('data'));
	var ar = parseDICOMStruct(jQuery(this).attr('data'));
	// we have now a group, tag structure with values
	console.log(JSON.stringify(ar));
	// highlight this image
	if (jQuery(this).hasClass('highlighted-human-a') || jQuery(this).hasClass('highlighted-human-b')) {
	    jQuery(this).removeClass('highlighted-human-a');
	    jQuery(this).removeClass('highlighted-human-b');
	} else {
	    if (e.shiftKey) {
		jQuery(this).addClass('highlighted-human-b');
	    } else {
		jQuery(this).addClass('highlighted-human-a');
	    }
	}

	// get a classification based on the selected subsets
	sendToClassifier();
    });
});