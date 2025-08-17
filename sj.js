const texts = {// 語言切換與多國語系處理
  en: {
    title: "Image Processor",         
    uploadLabel: "Upload Image",   
    widthLabel: "Width",          
    heightLabel: "Height",        
    autoScaleLabel: "Keep Ratio", 
    modeLabel: "Mode",         
    backendLabel: "Backend",      
    thresholdLabel: "Bitmap (1-bit) Black Threshold",  
    processBtn: "Process Image",    
    output: "Output will appear here",
    copyBtn: "Copy Output",         
    downloadBtn: "Download .h File"  ,
    flipLabel:"flip"
  },
  zh: {
    title: "圖片處理器",
    uploadLabel: "上傳圖片",
    widthLabel: "寬度",
    heightLabel: "高度",
    autoScaleLabel: "保持圖片比例不變形",
    modeLabel: "模式",
    backendLabel: "後端",
    thresholdLabel: "像素圖黑色閾值",
    processBtn: "處理圖片",
    output: "輸出將顯示在此",
    copyBtn: "複製輸出",
    downloadBtn: "下載輸出.h",
    flipLabel:"反轉顏色"
  }
};

let currentLang = "en"; // 預設語言為英文

// 切換語言並更新所有文字
function switchLang(lang) {
  currentLang = lang;
  const langTexts = texts[lang];

  for (const key in langTexts) {
    const element = document.getElementById(key);
    if (element) {
      let test = element.textContent;
      // 避免處理中的狀態被覆蓋
      if (key == "processBtn" && element.textContent == (lang == "en" ? "處理中..." : "Processing...")) {
        element.textContent = lang == "en" ? "Processing..." : "處理中...";
        return;
      }
      // 防止語言切換時覆蓋非預設狀態下的動態文字 導致顯示錯誤
      if (texts["en"][key] == test || texts["zh"][key] == test)
        element.textContent = langTexts[key];
    }
  }
  document.getElementById("langEn").classList.toggle("selected", lang === "en");
  document.getElementById("langZh").classList.toggle("selected", lang === "zh");
}

// 綁定語言切換按鈕
document.getElementById("langEn").onclick = () => switchLang("en");
document.getElementById("langZh").onclick = () => switchLang("zh");
switchLang("en"); // 初始載入預設為英文


// 圖片預覽與自動尺寸調整
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const autoScale = document.getElementById("autoScale");
const resetSizeBtn = document.getElementById("resetSizeBtn");
const checkbox = document.querySelector("#flip");

let origWidth = 0;  // 原始圖片寬度
let origHeight = 0; // 原始圖片高度

// 當選擇圖片後預覽與記錄原始尺寸
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    const img = new Image();
    img.onload = () => {
      origWidth = img.width;
      origHeight = img.height;
      widthInput.value = origWidth;
      heightInput.value = origHeight;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// 重置尺寸按鈕：回到原始尺寸
resetSizeBtn.addEventListener("click", () => {
  if (origWidth && origHeight) {
    widthInput.value = origWidth;
    heightInput.value = origHeight;
  }
});

// 若啟用「保持比例」，自動調整高度
widthInput.addEventListener("input", () => {
  if (autoScale.checked && origWidth && origHeight) {
    const w = parseInt(widthInput.value, 10);
    if (w > 0) {
      heightInput.value = Math.round(w * origHeight / origWidth);
    }
  }
});

// 若啟用「保持比例」，自動調整寬度
heightInput.addEventListener("input", () => {
  if (autoScale.checked && origWidth && origHeight) {
    const h = parseInt(heightInput.value, 10);
    if (h > 0) {
      widthInput.value = Math.round(h * origWidth / origHeight);
    }
  }
});

// 模式與後端切換邏輯控制
const modeSelect = document.getElementById("modeSelect");         // 模式選單
const backendSelect = document.getElementById("backendSelect");   // 後端選單

//選像素圖時啟用黑白閥值編輯
function bwopenclose() {
  const opt = document.getElementById("thresholdInput"); 
  if (modeSelect.value === "3") {//只有選到像素圖才開
    opt.disabled = false;      
  } else {
    opt.disabled = true;    
  }
}
modeSelect.addEventListener("change", bwopenclose); 

// 根據選擇的後端（adafruit 或 lcd）來控制模式選項
function toggle256Option() {
  const opt256 = modeSelect.querySelector('option[value="0"]'); // RGB256選項
  if (backendSelect.value === "adafruit") {
    opt256.disabled = true;            // Adafruit 不支援 RGB256
    if (modeSelect.value === "0") {
      modeSelect.value = "1";          // 自動切到 RGB565
    }
  } else {
    opt256.disabled = false;           // LCD 模式可以使用 RGB256
  }
}

toggle256Option(); // 初始化時執行一次
backendSelect.addEventListener("change", toggle256Option); // 切換後端時更新模式

// Pyodide 初始化與 Python 影像處理函式
let pyodideReady = loadPyodide({
  indexURL: "https://cdn.jsdelivr.net/pyodide/v0.21.3/full/"  // Pyodide 套件 CDN 位置
}).then(async py => {
  await py.loadPackage("micropip");           // 安裝 micropip 套件
  await py.runPythonAsync(`
import micropip
await micropip.install("pillow")              # 安裝 Pillow (PIL 圖像處理套件)
from PIL import Image, ImageOps
import io, base64




def image_to_h(data, w=None, h=None,mode=1,black = 50,backmode="lcd",invert=False):# backmode:adafruit or lcd
    img = Image.open(io.BytesIO(data)) 
    if invert:#開啟圖片並轉全彩(三種色都用8bi存)或灰階 還有反轉顏色
      img = ImageOps.invert(img.convert('L'if mode >1 else 'RGB'))
    else:img = img.convert('L'if mode >1 else 'RGB')

    if w and h:# 若有指定大小則縮放
        img = img.resize((w, h), Image.Resampling.LANCZOS)#縮放大小，用Resampling.lanczos的方式重取樣來製作 品質高，適合縮小圖片，能保留更多細節，邊緣比較平滑
        #取樣方式還有分NEAREST最近鄰取樣（速度快，但品質差，鋸齒明顯）；BILINEAR 雙線性取樣（品質較好，速度比 LANCZOS 快）;BICUBIC 雙立方取樣（品質比前一個好一點，適合一般縮放）；

    pixels = img.load()#載入像素圖


    
    out = []#用串列的方式存圖碼資料
    if backmode =="adafruit":
        match mode:
            case 1:# 將像素轉換為 RGB565 格式
                for y in range(h):
                    for x in range(w):
                        r, g, b = pixels[x, y]
                        rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)  #用捨去幾位的方式來存  RRRRRGGGGGGBBBBB 的 16-bit 格式
                        out.append(f"0x{rgb565:04X}")
            case 3:#轉黑白
                  img = img.point(lambda p: 0 if p < black else 255)#把預覽圖也處理
                  for y in range(h):
                    byte_val = 0#目這個byes的前像素資料
                    bit_count = 0#目前這個bytes存了幾個bi
                    for x in range(w):
                        pixel = pixels[x, y]
                        bit = 0 if pixel < black else 1   # 黑=0 白=1
                        byte_val = (byte_val << 1) | bit
                        bit_count += 1
                        if bit_count == 8:
                            out.append(f"0x{byte_val:02X}")
                            byte_val = 0
                            bit_count = 0
                    if bit_count > 0:#不足8bis就補齊(補0)
                        byte_val <<= (8 - bit_count)
                        out.append(f"0x{byte_val:02X}")
            case 2:#轉灰階圖(轉灰階然後依值轉成rgb565)
                for y in range(h):
                    for x in range(w):
                        pixel = pixels[x, y]  # 取得灰階像素（0~255）
                        r = g = b = pixel     # 灰階等同 RGB 三通道相等
                        rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
                        out.append(f"0x{rgb565:04X}")
                
    else:
        match mode:
            case 1:# 將像素轉換為 RGB565 格式
                for y in range(h):
                    for x in range(w):
                        r, g, b = pixels[x, y]
                        rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)  #用捨去幾位的方式來存  RRRRRGGGGGGBBBBB 的 16-bit 格式
                        
                        
                        # 拆成高位、低位各一 byte（lcdgfx 的格式）
                        out.append(f"0x{(rgb565 >> 8):02X}")
                        out.append(f"0x{rgb565 & 0xFF:02X}")
            case 3:  # 轉成黑白圖碼
                img = img.point(lambda p: 0 if p < black else 255)#把預覽圖也處理
                for y in range(0, h, 8):
                    for x in range(w):
                        byte_val = 0
                        for bit in range(8):
                            if (y + bit) < h:
                                pixel = pixels[x, y + bit]
                                bit_val = 0 if pixel < black else 1
                                byte_val |= (bit_val << bit)
                        out.append(f"0x{byte_val:02X}")
            case 0:  # 256 色（8-bit palette）
                for y in range(h):
                    for x in range(w):
                        r, g, b = pixels[x, y]# 轉換成 RRRGGGBB
                        r3 = (r >> 5) & 0x07  # 0-7
                        g3 = (g >> 5) & 0x07  # 0-7
                        b2 = (b >> 6) & 0x03  # 0-3
                        index = (r3 << 5) | (g3 << 2) | b2
                        out.append(f"0x{index:02X}")
            case 2:#轉灰階圖(轉灰階然後依值轉成rgb256)
                for y in range(h):
                    for x in range(w):
                        pixel = pixels[x, y]
                        r = g = b = pixel
                        r3 = (r >> 5) & 0x07  # 0-7
                        g3 = (g >> 5) & 0x07  # 0-7
                        b2 = (b >> 6) & 0x03  # 0-3
                        index = (r3 << 5) | (g3 << 2) | b2
                        out.append(f"0x{index:02X}")
                

    buf = io.BytesIO()#建立2進位的暫存器
    img.save(buf, 'PNG')#把剛的圖片轉碼後的存起來
    return base64.b64encode(buf.getvalue()).decode(), out#輸出轉碼後的圖片(預覽)和圖碼陣列
  `);
  return py;
});

// 前端按鈕邏輯：呼叫 Python 處理影像、產出 C 陣列並預覽圖片
document.getElementById("processBtn").onclick = async () => { // 取得按鈕並綁定點擊事件
  const processBtn = document.getElementById("processBtn");
  const file = imageInput.files[0]; // 取得上傳圖片的第一個檔案
  if (!file) return alert("Please upload an image first.");  // 未選圖片就跳出提示並結束
  else processBtn.textContent = currentLang == "en"?"Processing..":"處理中...";

  const w = +widthInput.value; // 取得寬度並轉數字
  const h = +heightInput.value; // 取得高度並轉數字
  const mode = +modeSelect.value; // 取得模式並轉數字
  const backend = backendSelect.value; // 取得後端選項字串
  const black = +document.getElementById("thresholdInput").value; // 閾值並轉數字
  console.log(checkbox.checked); // true 或 false

  const bytes = new Uint8Array(await file.arrayBuffer()); // 讀檔案轉成 Uint8Array（byte 陣列）
  const py = await pyodideReady; // 等待 Pyodide 載入完成
  const pyBytes = py.toPy(bytes); // 轉成 Python 可用資料

  py.globals.set("data", pyBytes); // 設定 Python 全域變數 data
  py.globals.set("w", w); // 設定寬度
  py.globals.set("h", h); // 設定高度
  py.globals.set("mode", mode); // 設定模式
  py.globals.set("black", black); // 設定閾值
  py.globals.set("backend", backend); // 設定後端
  py.globals.set("invert", checkbox.checked); // 設定反白

  await py.runPythonAsync(`b64, out = image_to_h(data, w, h, mode, black, backend,invert)`); // 呼叫 Python 函式處理圖片

  const b64 = py.globals.get("b64"); // 取得 base64 編碼圖片
  const outA = py.globals.get("out").toJs(); // 取得輸出陣列並轉成 JS 陣列
  const arr = outA.join(',').match(/([^,]+,?){1,16}/g).join('\n'); // 每 16 個元素換行
  const type = (mode === 3 || backend === 'lcd') ? "uint8_t" : "uint16_t"; // 決定資料型態

  preview.src = "data:image/png;base64," + b64; // 設定圖片預覽
  const body = `const ${type} image[${outA.length}] PROGMEM = {\n\t${arr.replaceAll("\n", "\n\t")}\n};`; // 格式化輸出字串
  document.getElementById("output").textContent = body; // 顯示在輸出區
  processBtn.textContent = currentLang == "en"?"Process Image":"處理圖片";


  // 產生可下載檔案
  const blob = new Blob([body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const dlBtn = document.getElementById("downloadBtn");
  dlBtn.style.display = "inline";
  dlBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "imageData.h";
    a.click();
  };

  // 複製按鈕功能
  const cpBtn = document.getElementById("copyBtn");
  cpBtn.style.display = "inline";
  cpBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(body);
      alert("Copied!");
    } catch {
      alert("Copy failed.");
    }
  };
};


