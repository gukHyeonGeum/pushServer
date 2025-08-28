import date from 'date-and-time';

export function formatToSQLDateTime(d: Date): string {
	return date.format(d, 'YYYY-MM-DD HH:mm:ss');
}
