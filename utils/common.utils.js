const dateTime = require('date-and-time');

// null check
module.exports.isEmpty = function (value) {
	if (value == "" || value == null || value == undefined || value == 'undefined' || value == 'none' || value == 'null' || ( value != null && typeof value == "object" && !Object.keys(value).length)) {
		return true
	} else {
		return false
	}
}

module.exports.formatToSQLDateTime = function(dateObj) {
	if (!dateObj || !(dateObj instanceof Date)) {
		return null;
	}
	return dateTime.format(dateObj, 'YYYY-MM-DD HH:mm:ss');
}