import { load } from 'cheerio';

// Function to parse holiday dates from HTML
function parseHolidays(html) {
  const $ = load(html);
  const holidays = {
    "2024": [],
    "2025": []
  };

  // Find all accordion headers
  $('.cmp-accordion__button').each((_, header) => {
    const headerText = $(header).find('.cmp-accordion__title').text().trim();
    if (headerText.includes('Holidays and Free Days')) {
      const year = headerText.match(/202[45]/)?.[0];
      if (!year) return;

      const panelId = $(header).attr('aria-controls');
      const panel = $(`#${panelId}`);
      
      panel.find('ul li').each((_, li) => {
        const holidayText = $(li).text().trim();
        if (holidayText) {
          const [description, date] = holidayText.split('—').map(part => part.trim());
          
          const parseDate = (dateStr, year) => {
            const monthMap = {
              'Jan.': 0, 'Jan': 0,
              'Feb.': 1, 'Feb': 1,
              'Mar.': 2, 'Mar': 2,
              'Apr.': 3, 'Apr': 3,
              'May': 4, 'May.': 4,
              'June': 5, 'Jun': 5,
              'July': 6, 'Jul': 6,
              'Aug.': 7, 'Aug': 7,
              'Sept.': 8, 'Sept': 8, 'Sep': 8,
              'Oct.': 9, 'Oct': 9,
              'Nov.': 10, 'Nov': 10,
              'Dec.': 11, 'Dec': 11
            };

            const [month, dayStr] = dateStr.split(' ');
            const day = parseInt(dayStr, 10);
            
            return new Date(parseInt(year, 10), monthMap[month], day);
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
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NVIDIA US Holidays//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:NVIDIA US Holidays'
  ].join('\r\n');

  Object.entries(holidays).forEach(([_, dates]) => {
    dates.forEach((holiday, i) => {
      const date = holiday.dateObj;
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${date.getFullYear()}${month}${day}`;
      
      icsContent += '\r\n' + [
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${dateString}`,
        `DTEND;VALUE=DATE:${dateString}`,
        `SUMMARY:${holiday.description}`,
        `DESCRIPTION:NVIDIA USHoliday - ${holiday.description}`,
        'SEQUENCE:0',
        'STATUS:CONFIRMED',
        `UID:nvidia-holiday-${i}-${date.getTime()}@nvidia.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z')}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      ].join('\r\n');
    });
  });

  icsContent += '\r\nEND:VCALENDAR';
  return icsContent;
}

async function fetchAndParseHolidays() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  const response = await fetch('https://www.nvidia.com/en-us/benefits/time-off/', { headers });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const html = await response.text();
  const holidays = parseHolidays(html);
  
  if (holidays["2024"].length === 0 && holidays["2025"].length === 0) {
    throw new Error('No holiday information found. The page structure might have changed.');
  }
  
  return generateICS(holidays);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const icsContent = await fetchAndParseHolidays();
      
      return new Response(icsContent, {
        headers: {
          'Content-Type': 'text/calendar',
          'Content-Disposition': 'attachment; filename="NVIDIA US Holidays.ics"'
        }
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, {
        status: 500,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }
  }
}; 