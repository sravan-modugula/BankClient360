export const formatCurrency = (amount: number, digits = 2) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(amount);
};


export const formatRelativeDate = (dateTime: string) => {
    // Date comes from API already formatted in PST
    const date = new Date(dateTime);

    // if we're unable to process the dateTime coming in, return none
    if (!dateTime || isNaN(date.getTime())) {
        return "None";
    }

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/* Note: this is specifically to format dates where we do not want the
   date to be converted into the locale time. Instead, we truncate the date and
   just grab the date part of it. 
*/
export const formatFlatDate = (dateString: string | undefined, days : number | null = null) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);

    if (days) {
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - days);
    }

    if (isNaN(date.getTime())) {
        return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC' // Essential for Z-ending strings
    });;
};
