const fileInput = document.getElementById('file-input');
const convertBtn = document.getElementById('convert-btn');
const downloadLinks = document.getElementById('download-links');
const postRequestBtn = document.getElementById('post-request-btn');
const cookieInput = document.getElementById('cookie-input');
const showSimplifiedDataBtn = document.getElementById('show-simplified-data-btn');
const simplifiedDataOutput = document.getElementById('simplified-data-output');
const notification = document.getElementById('notification');

let marksData = [];

function showNotification() {
    notification.classList.add('visible');
    setTimeout(() => {
        notification.classList.remove('visible');
    }, 5000);
}

convertBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) {
        alert('Нужно загрузить файл чтобы всё работало =)');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        const barcodes = json.map(row => row[0]).filter(barcode => barcode);

        marksData = barcodes.map(barcode => ({ number: barcode }));
        
        generateXMLFiles(barcodes);
    };
    reader.readAsArrayBuffer(file);
});

function generateXMLFiles(barcodes) {
    downloadLinks.innerHTML = '';
    
    if (barcodes.length === 0) {
        alert('Файл с марками пуст');
        return;
    }

    const chunks = [];
    for (let i = 0; i < barcodes.length; i += 99) {
        chunks.push(barcodes.slice(i, i + 99));
    }

    chunks.forEach((chunk, index) => {
        const xml = createXML(chunk);
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `marks-part-${index + 1}.xml`;
        link.textContent = `Скачать файл ${index + 1}`;
        downloadLinks.appendChild(link);
        downloadLinks.appendChild(document.createElement('br'));
    });
}

function createXML(barcodes) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Marks>\n`;
    barcodes.forEach(barcode => {
        xml += `    <Barcode>${barcode}</Barcode>\n`;
    });
    xml += `</Marks>`;
    return xml;
}

postRequestBtn.addEventListener('click', function () {
    const cookieValue = cookieInput.value.trim();

    if (!cookieValue) {
        alert('Введите Cookie');
        return;
    }

    fetchMarks(cookieValue, 1);
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const progress = document.getElementById('progress');
let totalRequests = 0; 
let completedRequests = 0;

async function fetchMarks(cookieValue, page) {
    const start = (page - 1) * 25;
    const limit = 25;

    fetch('http://localhost:3000/api/checkmarks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            cookie: cookieValue,
            page: page,
            start: start,
            limit: limit
        })
    })
    .then(response => response.json())
    .then(data => {
        const responseMarks = data.marks.map(mark => ({
            number: mark.number,
            id: mark.id
        }));
        
        marksData = marksData.map(mark => {
            const found = responseMarks.find(responseMark => responseMark.number === mark.number);
            return found ? { ...mark, id: found.id } : mark;
        });

        if (marksData.some(mark => !mark.id) && page < 25) {
            fetchMarks(cookieValue, page + 1);
        } else {
            totalRequests = marksData.filter(mark => mark.id).length;
            updateProgress(); 

            fetchMarkDetails(cookieValue, marksData).then(() => {
                showNotification();  
            });
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
    });
}

async function fetchMarkDetails(cookieValue, marksData) {
    for (const mark of marksData) {
        if (mark.id) {
            const page = 1;
            const start = 0;
            const limit = 25;

            await sleep(100);

            try {
                const response = await fetch('http://localhost:3000/api/markresult', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        cookie: cookieValue,
                        page: page,
                        start: start,
                        limit: limit,
                        mark_id: mark.id
                    })
                });

                const data = await response.json();

                if (data.success && data.marks.length > 0) {
                    const productDetails = data.marks[0];
                    mark.production = productDetails.Production;
                    mark.alcperc = productDetails.alcperc;
                    mark.capacity = productDetails.capacity;
                    mark.producer = productDetails.producer;
                }
                completedRequests++;
                updateProgress(); 

            } catch (error) {
                console.error('Ошибка при получении деталей марки:', error);
            }
        }
    }
}

function updateProgress() {
    progress.textContent = `Алкокод подобран к ${completedRequests} из ${totalRequests} марок`;
}


showSimplifiedDataBtn.addEventListener('click', () => {
    const simplifiedMarkData = marksData.map(mark => ({
        number: mark.number,                    
        production: extractCodeAP(mark.production) 
    }));

    simplifiedDataOutput.textContent = JSON.stringify(simplifiedMarkData, null, 2);
});

function extractCodeAP(production) {
    const match = production.match(/Код АП (\d+)/);
    return match ? match[1] : ''; 
}

const generateXlsBtn = document.getElementById('generate-xls-btn');

generateXlsBtn.addEventListener('click', () => {
    const simplifiedMarkData = marksData.map(mark => ({
        number: mark.number,
        production: extractCodeAP(mark.production) 
    }));

    const xlsData = simplifiedMarkData.map(mark => [mark.number, mark.production]);

    const worksheet = XLSX.utils.aoa_to_sheet(xlsData); 
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Marks');

    const xlsBlob = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsBlob], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'simplified_marks.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
