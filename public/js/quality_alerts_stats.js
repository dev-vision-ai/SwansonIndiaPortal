import { supabase } from "../supabase-config.js";

let allAlerts = []; // Store all fetched alerts globally

document.addEventListener('DOMContentLoaded', async () => {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error logging out:', error.message);
            } else {
                window.location.href = 'auth.html'; // Redirect to login page after logout
            }
        });
    }

    const applyCustomFilterButton = document.getElementById('applyCustomFilter');
    if (applyCustomFilterButton) {
        applyCustomFilterButton.addEventListener('click', applyCustomFilter);
    }

    await fetchAndDisplayStats();
});

async function fetchAndDisplayStats(startDate = null, endDate = null) {
    let query = supabase.from('quality_alerts').select('*');

    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }

    const { data: alerts, error } = await query;

    if (error) {
        console.error('Error fetching quality alerts:', error.message);
        return;
    }

    allAlerts = alerts; // Store all alerts for future filtering
    renderStats(alerts);
}

function applyCustomFilter() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    fetchAndDisplayStats(startDate, endDate);
}

function renderStats(alertsToDisplay) {
    // Overall Statistics
    document.getElementById('totalAlerts').textContent = alertsToDisplay.length;

    // Clear previous dynamic content
    document.getElementById('weeklyStatsContent').innerHTML = '';
    document.getElementById('monthlyStatsContent').innerHTML = '';
    document.getElementById('quarterlyStatsContent').innerHTML = '';
    document.getElementById('yearlyStatsContent').innerHTML = '';

    // Group alerts by time periods
    const weeklyAlerts = {};
    const monthlyAlerts = {};
    const quarterlyAlerts = {};
    const yearlyAlerts = {};

    alertsToDisplay.forEach(alert => {
        const createdAt = new Date(alert.created_at);

        // Weekly
        const weekStart = new Date(createdAt);
        weekStart.setDate(createdAt.getDate() - createdAt.getDay()); // Start of the week (Sunday)
        const weekKey = weekStart.toISOString().split('T')[0];
        weeklyAlerts[weekKey] = (weeklyAlerts[weekKey] || 0) + 1;

        // Monthly
        const monthKey = `${createdAt.getFullYear()}-${(createdAt.getMonth() + 1).toString().padStart(2, '0')}`;
        monthlyAlerts[monthKey] = (monthlyAlerts[monthKey] || 0) + 1;

        // Quarterly
        const quarter = Math.floor(createdAt.getMonth() / 3) + 1;
        const quarterKey = `${createdAt.getFullYear()}-Q${quarter}`;
        quarterlyAlerts[quarterKey] = (quarterlyAlerts[quarterKey] || 0) + 1;

        // Yearly
        const yearKey = `${createdAt.getFullYear()}`;
        yearlyAlerts[yearKey] = (yearlyAlerts[yearKey] || 0) + 1;
    });

    // Display Weekly Stats
    let weeklyHtml = '';
    for (const week in weeklyAlerts) {
        weeklyHtml += `<p>Week of ${week}: ${weeklyAlerts[week]} alerts</p>`;
    }
    document.getElementById('weeklyStatsContent').innerHTML = weeklyHtml;

    // Display Monthly Stats
    let monthlyHtml = '';
    for (const month in monthlyAlerts) {
        monthlyHtml += `<p>Month ${month}: ${monthlyAlerts[month]} alerts</p>`;
    }
    document.getElementById('monthlyStatsContent').innerHTML = monthlyHtml;

    // Display Quarterly Stats
    let quarterlyHtml = '';
    for (const quarter in quarterlyAlerts) {
        quarterlyHtml += `<p>Quarter ${quarter}: ${quarterlyAlerts[quarter]} alerts</p>`;
    }
    document.getElementById('quarterlyStatsContent').innerHTML = quarterlyHtml;

    // Display Yearly Stats
    let yearlyHtml = '';
    for (const year in yearlyAlerts) {
        yearlyHtml += `<p>Year ${year}: ${yearlyAlerts[year]} alerts</p>`;
    }
    document.getElementById('yearlyStatsContent').innerHTML = yearlyHtml;

    // You can add more detailed stats here, like by department, abnormality type, status, etc.
    // For example, to display by department for the current filtered set:
    const departmentCounts = {};
    alertsToDisplay.forEach(alert => {
        const department = alert.responsible_department || 'Unknown Department';
        departmentCounts[department] = (departmentCounts[department] || 0) + 1;
    });

    let departmentHtml = '<h2>Alerts by Responsible Department</h2>';
    for (const department in departmentCounts) {
        departmentHtml += `<p>- ${department}: ${departmentCounts[department]}</p>`;
    }
    // Assuming you have a div for this in your HTML, e.g., <div id="departmentStatsContent"></div>
    // For now, I'll just append it to overall stats or a new section if you add one.
    // document.getElementById('overall-stats').innerHTML += departmentHtml; // Example

    const abnormalityTypeCounts = {};
    alertsToDisplay.forEach(alert => {
        const type = alert.abnormality_type || 'Unknown Type';
        abnormalityTypeCounts[type] = (abnormalityTypeCounts[type] || 0) + 1;
    });

    let abnormalityTypeHtml = '<h2>Alerts by Abnormality Type</h2>';
    for (const type in abnormalityTypeCounts) {
        abnormalityTypeHtml += `<p>- ${type}: ${abnormalityTypeCounts[type]}</p>`;
    }

    const statusCounts = {};
    alertsToDisplay.forEach(alert => {
        const status = alert.status || 'Unknown Status';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    let statusHtml = '<h2>Alerts by Status</h2>';
    for (const status in statusCounts) {
        statusHtml += `<p>- ${status}: ${statusCounts[status]}</p>`;
    }

    // Append these to the overall stats or dedicated sections
    // For now, I will add them to the end of the overall stats div for demonstration.
    // You might want to create specific divs for these in your HTML.
    // document.getElementById('overall-stats').innerHTML += departmentHtml + abnormalityTypeHtml + statusHtml;

    // To display these in their own sections, you would need to add corresponding divs in quality_alerts_stats.html
    // For example:
    // <div id="department-stats"></div>
    // <div id="abnormality-stats"></div>
    // <div id="status-stats"></div>
    // Then update them here:
    // document.getElementById('department-stats').innerHTML = departmentHtml;
    // document.getElementById('abnormality-stats').innerHTML = abnormalityTypeHtml;
    // document.getElementById('status-stats').innerHTML = statusHtml;

    // For now, I will add them to the overall stats section as a temporary measure.
    // You should create dedicated divs for these in your HTML for better organization.
    const overallStatsDiv = document.getElementById('overall-stats');
    if (overallStatsDiv) {
        overallStatsDiv.innerHTML += departmentHtml + abnormalityTypeHtml + statusHtml;
    }

}