const cheerio = require('cheerio');

// Function to parse holiday dates from HTML
function parseHolidays(html) {
  const $ = cheerio.load(html);
  const holidays = {
    "2024": [],
    "2025": []
  };

  // Find all accordion headers
  $('.cmp-accordion__button').each((_, header) => {
    const headerText = $(header).find('.cmp-accordion__title').text().trim();
    if (headerText.includes('Holidays and Free Days')) {
      // Get the year from the header text
      const year = headerText.match(/202[45]/)?.[0];
      if (!year) return;

      // Find the associated panel using the aria-controls attribute
      const panelId = $(header).attr('aria-controls');
      const panel = $(`#${panelId}`);
      
      // Find all list items within this panel
      panel.find('ul li').each((_, li) => {
        const holidayText = $(li).text().trim();
        if (holidayText) {
          const [description, date] = holidayText.split('—').map(part => part.trim());
          
          // Parse the date string
          const parseDate = (dateStr, year) => {
            // Handle different month formats
            const monthMap = {
              'Jan.': 0, 'Jan': 0,
              'Feb.': 1, 'Feb': 1,
              'Mar.': 2, 'Mar': 2,
              'Apr.': 3, 'Apr': 3,
              'May': 4,
              'June': 5, 'Jun': 5,
              'July': 6, 'Jul': 6,
              'Aug.': 7, 'Aug': 7,
              'Sept.': 8, 'Sept': 8, 'Sep': 8,
              'Oct.': 9, 'Oct': 9,
              'Nov.': 10, 'Nov': 10,
              'Dec.': 11, 'Dec': 11
            };

            // Extract month and day
            const [month, dayStr] = dateStr.split(' ');
            const day = parseInt(dayStr, 10);
            
            console.log('Debug:', {
              dateStr,
              year,
              month,
              monthIndex: monthMap[month],
              day,
              parsedYear: parseInt(year, 10)
            });
            
            // Create Date object (months are 0-based in JavaScript)
            return new Date(parseInt(year, 10)+1, monthMap[month], day);
          };

          holidays[year].push({
            date,
            description,
            dateObj: parseDate(date, year)
          });
        }
      });
    }
  });

  return holidays;
}

function generateICS(holidays) {
  // ICS header
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NVIDIA Holidays//EN',
    'CALSCALE:GREGORIAN'
  ].join('\r\n');

  // Convert each holiday to an event
  Object.entries(holidays).forEach(([year, dates]) => {
    dates.forEach(holiday => {
      const date = holiday.dateObj;
      // Format date manually instead of using toISOString
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${date.getFullYear()}${month}${day}`;
      
      // Create event
      icsContent += '\r\n' + [
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${dateString}`,
        `DTEND;VALUE=DATE:${dateString}`,
        `SUMMARY:${holiday.description}`,
        `DESCRIPTION:NVIDIA Holiday - ${holiday.description}`,
        'SEQUENCE:0',
        'STATUS:CONFIRMED',
        `UID:nvidia-holiday-${date.getTime()}@nvidia.com`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      ].join('\r\n');
    });
  });

  // ICS footer
  icsContent += '\r\nEND:VCALENDAR';

  return icsContent;
}

async function fetchAndParseHolidays() {
  try {
    // Set up headers to mimic a browser request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };

    // Fetch the webpage
    const response = await fetch('https://www.nvidia.com/en-us/benefits/time-off/', { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const holidays = parseHolidays(html);
    
    // Generate ICS content
    const icsContent = generateICS(holidays);
    
    // Print the ICS content instead
    console.log('ICS Content:');
    console.log(icsContent);
    
    // Validate that we found holidays for both years
    if (holidays["2024"].length === 0 && holidays["2025"].length === 0) {
      throw new Error('No holiday information found. The page structure might have changed.');
    }
    
    return holidays;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Execute the main function
fetchAndParseHolidays().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});