import { useSync } from "@tui/context/sync"
import { createMemo, createSignal, For, Show, Switch, Match, onMount, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useTheme } from "../../context/theme"
import { useRoute } from "../../context/route"
import { Locale } from "@/util/locale"
import path from "path"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import { Global } from "@/global"
import { Installation } from "@/installation"
import { useKeybind } from "../../context/keybind"
import { useDirectory } from "../../context/directory"

// ═══════════════════════════════════════════════════════════════════════════
// ANIME GIRL ASCII ART ANIMATIONS - ULTRA SMOOTH EDITION
// Many more frames for buttery smooth animations!
// ═══════════════════════════════════════════════════════════════════════════

// IDLE STATE - Relaxed, breathing animation with floating effects
const ANIME_IDLE = [
  `    ∧＿∧      
   (｡･ω･｡)    ✧
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧     ✧
   (｡･ω･｡)   
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧    ✧ 
   (｡･ω･)      
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧   ✧  
   (｡･ω･)   ｡  
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧  ✧   
   (･ω･｡)  ｡   
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧ ✧    
   (･ω･｡)   ｡  
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧✧     
   (｡-ω-｡)  ～  
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧ ✧    
   (｡-ω-｡) ～♪  
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧  ✧   
   (｡-ω-｡)～♪   
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧   ✧  
   (｡･ω･｡) zzZ  
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧    ✧ 
   (｡･ω･｡)zzZ   
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
  `    ∧＿∧     ✧
   (｡･ω･｡) zZ   
   |つ　 つ      
   |　 |  Ready~
   \_/\_/       `,
]

// THINKING STATE - Head tilting, question marks floating
const ANIME_THINKING = [
  `    ∧＿∧      
   (´･ω･)      ?
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧     ?
   (´･ω･)っ     
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧    ? 
   (´･ω･)っ    ?
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧   ?  
   ( ･ω･)っ   ??
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧  ?   
   (･ω･´)っ  ???
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧ ?    
   (･ω･´)っ ???
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧?     
   (´-ω-)っ  💭
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧ ?    
   (´-ω-)っ 💭 
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧  ?   
   (･ω･｡)っ💭  
   |つ    |     
   |　   |think 
   \_/\_/       `,
  `    ∧＿∧   ?  
   (｡･ω･)っ 💭 
   |つ    |     
   |　   |think 
   \_/\_/       `,
]

// WORKING STATE - Intense typing with flying sparks!
const ANIME_WORKING = [
  `    ∧＿∧      
   (｡>ω<)っ⌨   ⚡
   |つ ＝    work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧     ⚡
   (>ω<｡)っ⌨  ⚡
   |つ ＝＝   work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧    ⚡⚡
   (｡>.<)っ⌨ ⚡
   |つ ＝＝＝ work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧   ⚡⚡⚡
   (>.<｡)っ⌨⚡
   |つ ＝＝   work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧  ✨⚡⚡
   (｡>ω<)っ⌨ ✨
   |つ ＝＝＝ work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧ ✨✨⚡
   (>ω<｡)っ⌨✨
   |つ ＝＝   work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧✨✨✨ 
   (｡>.<)っ⌨ ★
   |つ ＝＝＝ work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧ ★✨✨
   (>.<｡)っ⌨★
   |つ ＝＝   work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧  ★★✨
   (｡^ω^)っ⌨ ⚡
   |つ ＝＝＝ work
   |　 |        
   \_/\_/       `,
  `    ∧＿∧   ★★ 
   (^ω^｡)っ⌨⚡
   |つ ＝＝   work
   |　 |        
   \_/\_/       `,
]

// SEARCHING STATE - Eyes darting around with magnifying glass
const ANIME_SEARCHING = [
  `    ∧＿∧      
   (◉ω◉ )🔍    
   |つ　 つsearch
   |　 |        
   \_/\_/       `,
  `    ∧＿∧   🔍 
   (◉ω ◉)      
   |つ　 つsearch
   |　 |        
   \_/\_/       `,
  `    ∧＿∧  🔍  
   ( ◉ω◉) 🔎   
   |つ　 つsearch
   |　 |        
   \_/\_/       `,
  `    ∧＿∧ 🔍   
   (◉ ω◉)  🔎  
   |つ　 つsearch
   |　 |        
   \_/\_/       `,
  `    ∧＿∧🔍    
   (◎_◎ )   🔎 
   |つ　 つsearch
   |　 |        
   \_/\_/       `,
  `    ∧＿∧ 🔍   
   ( ◎_◎)    🔎
   |つ　 つsearch
   |　 |        
   \_/\_/       `,
  `    ∧＿∧  🔎  
   (◎ _◎)      
   |つ　 つsearch
   |　 |  found?
   \_/\_/       `,
  `    ∧＿∧   🔎 
   (◉ω◉ )!     
   |つ　 つsearch
   |　 |  found!
   \_/\_/       `,
]

// SUCCESS STATE - Happy bouncing celebration!
const ANIME_SUCCESS = [
  `    ∧＿∧  ✓   
   (＾ω＾)ノ     
   |つ　 つdone!
   |　 |        
   \_/\_/       `,
  `   ∧＿∧  ✓✓  
   (＾▽＾)ノ     
   |つ　 つdone!
   |　 |   ♪    
   \_/\_/       `,
  `  ∧＿∧  ✓✓✓ 
   (＾▽＾)ノ     
    |つ　つdone!
    |　|   ♪♪   
   \_/\_/       `,
  `   ∧＿∧ ★✓✓  
   (*＾ω＾)ノ    
   |つ　 つdone!
   |　 |  ♪♪♪   
   \_/\_/       `,
  `    ∧＿∧★★✓  
   (＾ω＾*)ノ    
   |つ　 つdone!
   |　 |  ♪♪    
   \_/\_/       `,
  `    ∧＿∧ ★★  
   (*＾▽＾)ノ✨  
   |つ　 つdone!
   |　 |   ♪    
   \_/\_/       `,
  `   ∧＿∧  ★   
   (＾▽＾*)ノ ✨ 
    |つ　つdone!
    |　|        
   \_/\_/       `,
  `    ∧＿∧     
   (＾ω＾)ノ  ✨ 
   |つ　 つdone!
   |　 |    ★   
   \_/\_/       `,
]

// ERROR STATE - Distressed with sweat drops
const ANIME_ERROR = [
  `    ∧＿∧  ✗   
   (;ω;)       
   |つ　 つerror
   |　 |        
   \_/\_/       `,
  `    ∧＿∧ ✗✗  
   (´;ω;)  💦  
   |つ　 つerror
   |　 |        
   \_/\_/       `,
  `    ∧＿∧✗✗   
   (;ω;´) 💦💦 
   |つ　 つerror
   |　 |        
   \_/\_/       `,
  `    ∧＿∧ ✗   
   (;_;)  💦   
   |つ　 つerror
   |　 |   💢   
   \_/\_/       `,
  `    ∧＿∧  💢  
   (´;_;)      
   |つ　 つerror
   |　 |  💢💢  
   \_/\_/       `,
  `    ∧＿∧ 💢   
   (T_T)   !!  
   |つ　 つerror
   |　 |   💢   
   \_/\_/       `,
  `    ∧＿∧  !!  
   (T︵T)  💦  
   |つ　 つerror
   |　 |        
   \_/\_/       `,
  `    ∧＿∧   !  
   (;ω;)  💦   
   |つ　 つerror
   |　 |        
   \_/\_/       `,
]

// WAITING STATE - Looking around impatiently
const ANIME_WAITING = [
  `    ∧＿∧      
   (･ω･ )？    
   |つ　 つ ...  
   |　 |  wait  
   \_/\_/       `,
  `    ∧＿∧   ？ 
   ( ･ω･)      
   |つ　 つ ..   
   |　 |  wait  
   \_/\_/       `,
  `    ∧＿∧  ？  
   (･ω･ )？    
   |つ　 つ .    
   |　 |  wait  
   \_/\_/       `,
  `    ∧＿∧ ？   
   ( ･ω･)？？  
   |つ　 つ      
   |　 |  wait  
   \_/\_/       `,
  `    ∧＿∧？    
   (･_･ ) 👀   
   |つ　 つ ...  
   |　 |  wait  
   \_/\_/       `,
  `    ∧＿∧ ？   
   ( ･_･)  👀  
   |つ　 つ ..   
   |　 |  wait  
   \_/\_/       `,
  `    ∧＿∧  ？  
   (･_･ )   👀 
   |つ　 つ .    
   |　 |  wait  
   \_/\_/       `,
  `    ∧＿∧   ？ 
   ( ･_･) 👀   
   |つ　 つ      
   |　 |  wait  
   \_/\_/       `,
]

// INSTALLING STATE - Progress bar filling up
const ANIME_INSTALLING = [
  `    ∧＿∧ ⚙   
   (･ω･)つ📦   
   |つ   install
   |　 | [░░░░░]
   \_/\_/       `,
  `    ∧＿∧  ⚙  
   (･ω･)つ📦   
   |つ   install
   |　 | [█░░░░]
   \_/\_/       `,
  `    ∧＿∧ ⚙⚙  
   (･ω･)つ📦   
   |つ   install
   |　 | [██░░░]
   \_/\_/       `,
  `    ∧＿∧⚙⚙   
   (･ω･)つ📦   
   |つ   install
   |　 | [███░░]
   \_/\_/       `,
  `    ∧＿∧ ⚙⚙⚙ 
   (＾ω＾)つ📦  
   |つ   install
   |　 | [████░]
   \_/\_/       `,
  `    ∧＿∧⚙⚙⚙  
   (＾▽＾)つ📦  
   |つ   install
   |　 | [█████]
   \_/\_/   ✓   `,
  `    ∧＿∧  ✓   
   (＾ω＾)ノ📦  
   |つ   install
   |　 | [█████]
   \_/\_/  done!`,
  `    ∧＿∧   ✓  
   (＾▽＾)ノ 📦 
   |つ   install
   |　 | [█████]
   \_/\_/ done! `,
]

// WRITING STATE - Pen moving across page
const ANIME_WRITING = [
  `    ∧＿∧  ✎   
   (･ω･)φ      
   |つ ＿  write
   |　 |        
   \_/\_/       `,
  `    ∧＿∧   ✎  
   (･ω･)φ＿    
   |つ    write 
   |　 |        
   \_/\_/       `,
  `    ∧＿∧  ✎✎  
   (･ω･)φ＿＿  
   |つ    write 
   |　 |        
   \_/\_/       `,
  `    ∧＿∧ ✎✎   
   (･ω･)φ＿＿＿
   |つ    write 
   |　 |        
   \_/\_/       `,
  `    ∧＿∧✎✎✎   
   (＾ω＾)φ____
   |つ    write 
   |　 |   ♪    
   \_/\_/       `,
  `    ∧＿∧ ✎✎✎  
   (＾▽＾)φ_____
   |つ    write 
   |　 |  ♪♪    
   \_/\_/       `,
  `    ∧＿∧  ✓   
   (＾ω＾)ノ    
   |つ    write 
   |　 | done!  
   \_/\_/       `,
  `    ∧＿∧   ✓  
   (＾▽＾)ノ ✨ 
   |つ    write 
   |　 | done!  
   \_/\_/       `,
]

// DEPLOYING STATE - Rocket launch sequence!
const ANIME_DEPLOYING = [
  `    ∧＿∧      
   (>_<)ノ 🚀  
   |つ　 つ  3..
   |　 |        
   \_/\_/       `,
  `    ∧＿∧      
   (>.<)ノ  🚀 
   |つ　 つ  2..
   |　 |    ↑   
   \_/\_/       `,
  `    ∧＿∧      
   (＾o＾)ノ  🚀
   |つ　 つ  1..
   |　 |   ↑↑   
   \_/\_/       `,
  `    ∧＿∧    🚀
   (＾▽＾)ノ    
   |つ　 つ  GO!
   |　 |  ↑↑↑   
   \_/\_/   ✨  `,
  `    ∧＿∧   🚀 
   (＾▽＾)ノ  ↑ 
   |つ　 つ     
   |　 | ↑↑↑ ✨ 
   \_/\_/  ✨✨ `,
  `    ∧＿∧  🚀  
   (*＾▽＾)ノ ↑↑
   |つ　 つ     
   |　 |↑↑↑ ✨✨
   \_/\_/ ✨✨✨`,
  `    ∧＿∧ 🚀   
   (＾ω＾*)ノ↑↑↑
   |つ　 つ     
   |　 |  ★✨✨ 
   \_/\_/★✨✨✨`,
  `    ∧＿∧🚀    
   (*＾ω＾)ノ ★ 
   |つ　 つLIVE!
   |　 | ★★✨✨ 
   \_/\_/★★✨✨ `,
]

// SECURITY STATE - Scanning animation
const ANIME_SECURITY = [
  `    ∧＿∧ 🛡   
   (⌐■_■)      
   |つ　 つscan 
   |　 | [░░░░]
   \_/\_/       `,
  `    ∧＿∧  🛡  
   (⌐■_■)🔒    
   |つ　 つscan 
   |　 | [█░░░]
   \_/\_/       `,
  `    ∧＿∧ 🛡🔒 
   (⌐■_■)      
   |つ　 つscan 
   |　 | [██░░]
   \_/\_/       `,
  `    ∧＿∧🛡🔒  
   (⌐■_■)🔐    
   |つ　 つscan 
   |　 | [███░]
   \_/\_/       `,
  `    ∧＿∧ 🛡🔒✓
   (⌐■_■)b     
   |つ　 つscan 
   |　 | [████]
   \_/\_/secure!`,
  `    ∧＿∧🛡🔒✓ 
   (⌐■‿■)b  ✨ 
   |つ　 つscan 
   |　 | [████]
   \_/\_/secure!`,
]

// DATABASE STATE - Query animation
const ANIME_DATABASE = [
  `    ∧＿∧ 💾   
   (･ω･)      
   |つ    query
   |　 | SELECT
   \_/\_/       `,
  `    ∧＿∧  💾  
   (･ω･)📊    
   |つ    query
   |　 |  FROM 
   \_/\_/       `,
  `    ∧＿∧ 💾💾 
   (･ω･) 📊   
   |つ    query
   |　 | WHERE 
   \_/\_/       `,
  `    ∧＿∧💾💾  
   (･ω･)  📊  
   |つ    query
   |　 |  ...  
   \_/\_/       `,
  `    ∧＿∧ 💾   
   (＾ω＾)📊   
   |つ    query
   |　 |  ✓    
   \_/\_/       `,
  `    ∧＿∧  ✓   
   (＾▽＾)📊📊 
   |つ    query
   |　 | done! 
   \_/\_/       `,
]

// API STATE - Request/Response animation
const ANIME_API = [
  `    ∧＿∧      
   (･ω･)→     
   |つ    fetch
   |　 | GET→  
   \_/\_/       `,
  `    ∧＿∧   ⚡ 
   (･ω･) →→   
   |つ    fetch
   |　 | →→→  
   \_/\_/       `,
  `    ∧＿∧  ⚡⚡ 
   (･ω･)  →→→ 
   |つ    fetch
   |　 |  ...  
   \_/\_/       `,
  `    ∧＿∧ ⚡⚡⚡
   (･ω･)   ←  
   |つ    fetch
   |　 | ←←←  
   \_/\_/       `,
  `    ∧＿∧  ⚡  
   (＾ω＾)←←   
   |つ📦  fetch
   |　 | 200 OK
   \_/\_/       `,
  `    ∧＿∧   ✓  
   (＾▽＾)ノ📦 
   |つ    fetch
   |　 | done! 
   \_/\_/       `,
]

// TESTING STATE - Tests running with results
const ANIME_TESTING = [
  `    ∧＿∧ 🧪   
   (･ω･)      
   |つ    test 
   |　 | ○○○○  
   \_/\_/       `,
  `    ∧＿∧  🧪  
   (･ω･)✓     
   |つ    test 
   |　 | ●○○○  
   \_/\_/       `,
  `    ∧＿∧ 🧪   
   (＾ω＾)✓✓   
   |つ    test 
   |　 | ●●○○  
   \_/\_/       `,
  `    ∧＿∧🧪    
   (＾ω＾)✓✓✓  
   |つ    test 
   |　 | ●●●○  
   \_/\_/       `,
  `    ∧＿∧  ✓   
   (＾▽＾)✓✓✓✓
   |つ    test 
   |　 | ●●●●  
   \_/\_/  pass!`,
  `    ∧＿∧   ✓  
   (*＾▽＾)ノ✨ 
   |つ    test 
   |　 | ●●●●  
   \_/\_/ pass! `,
]

// MONITORING STATE - Live metrics animation
const ANIME_MONITORING = [
  `    ∧＿∧ 📡   
   (◔_◔)      
   |つ📈 monitor
   |　 | ▁▂▃▄  
   \_/\_/       `,
  `    ∧＿∧  📡  
   (◔_◔) 📈   
   |つ   monitor
   |　 | ▂▃▄▅  
   \_/\_/       `,
  `    ∧＿∧ 📡   
   (◔‿◔)  📈  
   |つ   monitor
   |　 | ▃▄▅▆  
   \_/\_/       `,
  `    ∧＿∧📡    
   (◔‿◔)   📈 
   |つ   monitor
   |　 | ▄▅▆▇  
   \_/\_/       `,
  `    ∧＿∧ 📡   
   (＾‿＾)📈   
   |つ   monitor
   |　 | ▅▆▇█  
   \_/\_/   ✓   `,
  `    ∧＿∧  📡✓ 
   (＾▽＾)📈📈 
   |つ   monitor
   |　 | ▆▇██  
   \_/\_/  OK!  `,
]

// YOLO STATE - Chaotic, fast, slightly unhinged
const ANIME_YOLO = [
  `    ∧＿∧  ⚡⚡  
   (☉ω☉)ノ⌨ YOLO
   |つ ≡≡≡≡    
   |　 | SEND IT
   \_/\_/  !!   `,
  `   ∧＿∧ ⚡⚡⚡ 
   (◎ω◎)ノ⌨YOLO
    |つ≡≡≡≡≡   
    |　|SEND IT!
   \_/\_/ !!!  `,
  `    ∧＿∧⚡⚡⚡⚡
   (✧ω✧)っ⌨YOLO
   |つ ≡≡≡≡    
   |　 |NO FEAR
   \_/\_/ !!!!`,
  `  ∧＿∧  💨💨 
   (>ω<)ノ⌨ YOLO
    |つ≡≡≡≡≡≡  
    |　| FAST! 
   \_/\_/⚡⚡⚡ `,
  `    ∧＿∧ 🔥🔥 
   (☆ω☆)っ⌨YOLO
   |つ ≡≡≡≡    
   |　 |TRUST ME
   \_/\_/ 💨💨`,
  `   ∧＿∧🔥🔥🔥
   (◉ω◉)ノ⌨YOLO
    |つ≡≡≡≡≡   
    |　| WCGW? 
   \_/\_/  ⚡  `,
  `    ∧＿∧ ⚡🔥 
   (≧ω≦)っ⌨YOLO
   |つ ≡≡≡≡    
   |　 |LGTM!!
   \_/\_/ 🚀🚀`,
  `  ∧＿∧  🚀🚀 
   (*>ω<)ノ⌨YOLO
    |つ≡≡≡≡≡   
    |　|SHIP IT
   \_/\_/💨💨💨`,
]

// YOLO EXTREME STATE - Absolutely unhinged, chaotic energy
const ANIME_YOLO_EXTREME = [
  `    ∧＿∧ 💀🔥💀
   (◣Д◢)ノ⌨    
   |つ    EXTREME
   |　 | !!YOLO!!
   \_/\_/ 🔥🔥🔥`,
  `  ∧＿∧💀💀💀💀
   (⊙△⊙)ノ⌨    
    |つ   EXTREME
    |　|HOLD BEER
   \_/\_/☠️☠️☠️`,
  `    ∧＿∧ ☠️🔥☠️
   (◎Д◎)っ⌨    
   |つ    EXTREME
   |　 |NOBACKUP
   \_/\_/💣💣💣`,
  `  ∧＿∧💥💥💥💥
   (╬ಠ益ಠ)⌨    
    |つ   EXTREME
    |　| ROOTPLS
   \_/\_/ ☠️☠️`,
  `    ∧＿∧☠️💥☠️
   (◣_◢)ノ⌨    
   |つ    EXTREME
   |　 |YEETSYS
   \_/\_/💀💀💀`,
  `  ∧＿∧ 🔥💀🔥
   (ↀДↀ)っ⌨    
    |つ   EXTREME
    |　|RMRF OK?
   \_/\_/💣💣💣`,
  `    ∧＿∧💣💣💣
   (☣Д☣)ノ⌨    
   |つ    EXTREME
   |　 | SUDO!!
   \_/\_/☠️💥☠️`,
  `  ∧＿∧ ☢️☢️☢️
   (◎ロ◎)っ⌨    
    |つ   EXTREME
    |　|FULL SEND
   \_/\_/🔥🔥🔥`,
  `    ∧＿∧💀☢️💀
   (✖Д✖)ノ⌨    
   |つ    EXTREME
   |　 |CHAOS!!!
   \_/\_/💥💥💥`,
  `  ∧＿∧ 💥☣️💥
   (ↂ_ↂ)っ⌨    
    |つ   EXTREME
    |　|PROD?LOL
   \_/\_/☠️☠️☠️`,
]

// Simple one-liner fallbacks for compact display
const SIMPLE_IDLE = [
  "✧(◠‿◠)✧  Ready~",
  "✦(◠‿◠)✦  Ready~",
  "♪(◠‿◠)♪  Ready~",
  "～(◠‿◠)～ Ready~",
]

const SIMPLE_THINKING = [
  "(´･ω･)?  thinking...",
  "(･ω･´)?? thinking...",
  "(´-ω-)?  thinking...",
  "(･ω･｡)💭 thinking...",
]

const SIMPLE_WORKING = [
  "(｡>ω<)⚡ working!",
  "(>ω<｡)⚡ working!",
  "(｡>.<)✨ working!",
  "(>.<｡)✨ working!",
]

const SIMPLE_YOLO = [
  "(☉ω☉)⚡ YOLO!!",
  "(◎ω◎)🔥 SEND IT!",
  "(✧ω✧)💨 NO FEAR!",
  "(≧ω≦)🚀 SHIP IT!",
]

const SIMPLE_YOLO_EXTREME = [
  "(◣Д◢)💀 EXTREME!!",
  "(⊙△⊙)☠️ HOLD BEER!",
  "(╬ಠ益ಠ)🔥 YEET!!!",
  "(☣Д☣)💥 CHAOS!!!",
]

// Animation state types
type AnimationState = "idle" | "thinking" | "working" | "searching" | "success" | "error" | "waiting" | "installing" | "writing" | "deploying" | "security" | "database" | "api" | "testing" | "monitoring" | "yolo" | "yolo_extreme"

// Map states to their full animations
const FULL_ANIMATIONS: Record<AnimationState, string[]> = {
  idle: ANIME_IDLE,
  thinking: ANIME_THINKING,
  working: ANIME_WORKING,
  searching: ANIME_SEARCHING,
  success: ANIME_SUCCESS,
  error: ANIME_ERROR,
  waiting: ANIME_WAITING,
  installing: ANIME_INSTALLING,
  writing: ANIME_WRITING,
  deploying: ANIME_DEPLOYING,
  security: ANIME_SECURITY,
  database: ANIME_DATABASE,
  api: ANIME_API,
  testing: ANIME_TESTING,
  monitoring: ANIME_MONITORING,
  yolo: ANIME_YOLO,
  yolo_extreme: ANIME_YOLO_EXTREME,
}

// Simple one-liner animations for status bar
const SIMPLE_ANIMATIONS: Record<string, string[]> = {
  idle: SIMPLE_IDLE,
  thinking: SIMPLE_THINKING,
  working: SIMPLE_WORKING,
  yolo: SIMPLE_YOLO,
  yolo_extreme: SIMPLE_YOLO_EXTREME,
}

// Map agent names to animation states
const AGENT_TO_STATE: Record<string, AnimationState> = {
  "general": "thinking",
  "explore": "searching",
  "system-package-manager": "installing",
  "website-deployment-manager": "deploying",
  "fivelidz-security-auditor": "security",
  "fivelidz-content-writer": "writing",
  "fivelidz-database-manager": "database",
  "fivelidz-api-specialist": "api",
  "fivelidz-qa-tester": "testing",
  "fivelidz-devops-monitor": "monitoring",
  // YOLO modes - chaotic energy
  "yolo": "yolo",
  "yolo-mode": "yolo",
  "yolo-extreme": "yolo_extreme",
  "extreme": "yolo_extreme",
  "chaos": "yolo_extreme",
}

// Legacy simple format for backwards compatibility
const THINKING_FRAMES = SIMPLE_THINKING
const PROCESSING_FRAMES = [
  "[■□□□□] processing",
  "[■■□□□] processing",
  "[■■■□□] processing",
  "[■■■■□] processing",
  "[■■■■■] processing",
  "[□■■■■] processing",
  "[□□■■■] processing",
  "[□□□■■] processing",
  "[□□□□■] processing",
]

export function Sidebar(props: {
  sessionID: string
  activeSubagentSessionID?: string  // Optional: show this subagent's data instead (for parent view)
  onReturnToMain?: () => void  // Callback to clear subagent selection and return to main session info
}) {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()
  
  // Check if the main sessionID is itself a subagent (has a parent)
  const mainSession = createMemo(() => sync.session.get(props.sessionID))
  const isDirectSubagentView = createMemo(() => !!mainSession()?.parentID)
  
  // Determine which session to display:
  // 1. If activeSubagentSessionID is passed (from parent view's panel), use that
  // 2. If we're directly viewing a subagent, use the sessionID
  // 3. Otherwise use the main sessionID
  const displaySessionID = createMemo(() => {
    if (props.activeSubagentSessionID) return props.activeSubagentSessionID
    return props.sessionID
  })
  
  const isShowingSubagent = createMemo(() => {
    return !!props.activeSubagentSessionID || isDirectSubagentView()
  })
  
  // Get subagent info - works for both panel selection and direct view
  const subagentInfo = createMemo(() => {
    const subSessionID = props.activeSubagentSessionID || (isDirectSubagentView() ? props.sessionID : null)
    if (!subSessionID) return null
    
    const subSession = sync.session.get(subSessionID)
    if (!subSession) return null
    
    // Extract agent type and short name from title
    const title = subSession.title || "Subagent"
    const agentTypeMatch = title.match(/@([a-z-]+)\s+subagent/i)
    const agentType = agentTypeMatch ? agentTypeMatch[1] : "subagent"
    const shortName = title.replace(/\s*\(@[a-z-]+\s+subagent\)\s*$/i, "").trim() || "task"
    
    // Find task number (position among siblings)
    const parentID = subSession.parentID
    const siblings = parentID 
      ? sync.data.session.filter(s => s.parentID === parentID).sort((a, b) => a.time.created - b.time.created)
      : []
    const taskNumber = siblings.findIndex(s => s.id === subSession.id) + 1
    
    return { agentType, shortName, taskNumber, title }
  })
  
  // Get parent session (for display when viewing subagent)
  const parentSession = createMemo(() => {
    if (isDirectSubagentView()) {
      return sync.session.get(mainSession()!.parentID!)
    }
    if (props.activeSubagentSessionID) {
      return mainSession()
    }
    return null
  })
  
  const session = createMemo(() => sync.session.get(props.sessionID)!)
  const displaySession = createMemo(() => sync.session.get(displaySessionID())!)
  const diff = createMemo(() => sync.data.session_diff[displaySessionID()] ?? [])
  const todo = createMemo(() => sync.data.todo[displaySessionID()] ?? [])
  const messages = createMemo(() => sync.data.message[displaySessionID()] ?? [])
  const status = createMemo(() => sync.data.session_status[displaySessionID()] ?? { type: "idle" })
  
  // Get session branches/forks - find siblings (same parent) and children
  const sessionFamily = createMemo(() => {
    const currentSession = session()
    if (!currentSession) return { parent: null, siblings: [], children: [] }
    
    const parentID = currentSession.parentID
    const allSessions = sync.data.session
    
    // Find parent session
    const parent = parentID ? allSessions.find(s => s.id === parentID) : null
    
    // Find siblings (other sessions with same parent, excluding self)
    const siblings = parentID 
      ? allSessions.filter(s => s.parentID === parentID && s.id !== currentSession.id)
      : []
    
    // Find children (sessions that have this session as parent)
    const children = allSessions.filter(s => s.parentID === currentSession.id)
    
    return { parent, siblings, children }
  })

  // Animation state - tracks frame number for animations
  const [frame, setFrame] = createSignal(0)
  const [showFullArt, setShowFullArt] = createSignal(true) // Toggle for full ASCII art vs compact
  let intervalId: ReturnType<typeof setInterval> | undefined

  onMount(() => {
    // Animate at 250ms intervals for buttery smooth animation!
    intervalId = setInterval(() => {
      setFrame((f) => (f + 1) % 12) // Most animations now have 8-12 frames
    }, 250)
  })

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId)
  })

  // Determine current animation state based on session status and activity
  const currentAnimState = createMemo((): AnimationState => {
    const st = status()
    if (st.type === "idle") return "idle"
    if (st.type === "retry") return "waiting"
    
    // When showing a subagent, use agent-specific animation
    if (isShowingSubagent() && subagentInfo()) {
      const agentType = subagentInfo()!.agentType
      return AGENT_TO_STATE[agentType] || "working"
    }
    
    // When busy, could be working, but we can infer more from last tool
    return "working"
  })

  // Get the current animation frame based on state
  const currentAnimation = createMemo(() => {
    const state = currentAnimState()
    const animations = FULL_ANIMATIONS[state] || ANIME_THINKING
    return animations[frame() % animations.length]
  })

  // Simple one-liner for status bar
  const simpleAnimation = createMemo(() => {
    const state = currentAnimState()
    const animations = SIMPLE_ANIMATIONS[state] || SIMPLE_THINKING
    return animations[frame() % animations.length]
  })

  // Get current model from last assistant message
  const currentModel = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant") as AssistantMessage
    if (!last?.modelID) return "No model"
    // Extract just the model name from full ID
    const parts = last.modelID.split("/")
    return parts[parts.length - 1] || last.modelID
  })

  // Get directory early - needed by shortDir memo
  const directory = useDirectory()

  // Git branch will be shown if available via directory context
  const gitBranch = createMemo(() => {
    // Git info not directly in sync data, would need separate fetch
    // For now, return null - can be enhanced later
    return null
  })

  // Get shortened directory name
  const shortDir = createMemo(() => {
    const dir = directory()
    if (!dir) return "~"
    const home = process.env.HOME || ""
    if (dir.startsWith(home)) {
      return "~" + dir.slice(home.length)
    }
    return dir
  })

  const [expanded, setExpanded] = createStore({
    mcp: true,
    diff: true,
    todo: true,
    lsp: true,
    branches: true,
  })

  // Sort MCP servers alphabetically for consistent display order
  const mcpEntries = createMemo(() => Object.entries(sync.data.mcp).sort(([a], [b]) => a.localeCompare(b)))

  const cost = createMemo(() => {
    const total = messages().reduce((sum, x) => sum + (x.role === "assistant" ? x.cost : 0), 0)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total)
  })

  // Calculate both CURRENT (last request) and CUMULATIVE token usage
  // Also estimate Claude Max usage (rough estimate based on ~5M tokens/week for Max 20x)
  const context = createMemo(() => {
    const assistantMessages = messages().filter((x) => x.role === "assistant") as AssistantMessage[]
    if (assistantMessages.length === 0) return
    
    // Get the last message for current context
    const last = assistantMessages.at(-1)
    const currentTokens = last?.tokens 
      ? (last.tokens.input || 0) + (last.tokens.output || 0) + (last.tokens.reasoning || 0) + 
        (last.tokens.cache?.read || 0) + (last.tokens.cache?.write || 0)
      : 0
    
    // Sum all tokens across all assistant messages for cumulative
    const cumulative = assistantMessages.reduce(
      (acc, msg) => {
        if (msg.tokens) {
          acc += (msg.tokens.input || 0) + (msg.tokens.output || 0) + (msg.tokens.reasoning || 0) +
                 (msg.tokens.cache?.read || 0) + (msg.tokens.cache?.write || 0)
        }
        return acc
      },
      0
    )
    
    // Get model context limit from the most recent message
    const model = last ? sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID] : undefined
    const contextLimit = model?.limit?.context
    
    // Format cumulative tokens nicely (e.g., 1.2M, 450K, etc.)
    const formatTokens = (n: number) => {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
      if (n >= 1_000) return (n / 1_000).toFixed(0) + "K"
      return n.toString()
    }
    
    return {
      current: currentTokens.toLocaleString(),
      currentFormatted: formatTokens(currentTokens),
      cumulative: cumulative.toLocaleString(),
      cumulativeFormatted: formatTokens(cumulative),
      cumulativeRaw: cumulative,
      percentage: contextLimit ? Math.round((currentTokens / contextLimit) * 100) : null,
      limit: contextLimit ? (contextLimit / 1000).toFixed(0) + "k" : null,
    }
  })

  const keybind = useKeybind()

  const hasProviders = createMemo(() =>
    sync.data.provider.some((x) => x.id !== "opencode" || Object.values(x.models).some((y) => y.cost?.input !== 0)),
  )

  return (
    <Show when={session()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={42}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
      >
        <scrollbox flexGrow={1}>
          <box flexShrink={0} gap={1} paddingRight={1}>
            {/* Anime Assistant - Full ASCII Art Display */}
            <box 
              onMouseDown={() => setShowFullArt(!showFullArt())}
            >
              <Show when={showFullArt()}>
                <text 
                  fg={status().type === "busy" ? theme.warning : status().type === "retry" ? "#ff79c6" : theme.success}
                  wrapMode="char"
                >
                  {currentAnimation()}
                </text>
              </Show>
              <Show when={!showFullArt()}>
                <Show
                  when={status().type === "busy"}
                  fallback={
                    <text fg={theme.success}>
                      <b>{SIMPLE_ANIMATIONS.idle[frame() % SIMPLE_ANIMATIONS.idle.length]}</b>
                    </text>
                  }
                >
                  <text fg={theme.warning}>
                    <b>{simpleAnimation()}</b>
                  </text>
                </Show>
              </Show>
              <text fg={theme.textMuted}>{currentModel()}</text>
            </box>

            {/* Active Subagent Banner - shown when viewing a subagent */}
            <Show when={isShowingSubagent() && subagentInfo()}>
              <box
                backgroundColor={theme.backgroundElement}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
                border={["left"]}
                borderColor={theme.accent}
              >
                <text fg={theme.accent}>
                  <b>#{subagentInfo()!.taskNumber} @{subagentInfo()!.agentType}</b>
                </text>
                <text fg={theme.text}>
                  <b>{subagentInfo()!.shortName}</b>
                </text>
                <text fg={theme.textMuted}>
                  {status().type === "busy" ? "Working..." : status().type === "retry" ? "Retrying..." : "Completed"}
                </text>
                {/* Return to Main button - only when viewing from parent via subagent panel */}
                <Show when={props.activeSubagentSessionID && props.onReturnToMain}>
                  <box
                    onMouseDown={() => props.onReturnToMain?.()}
                    paddingTop={1}
                  >
                    <text fg={theme.primary}>
                      <b>[ ◆ Return to Main ]</b>
                    </text>
                  </box>
                </Show>
              </box>
            </Show>

            {/* Directory & Git Section */}
            <box>
              <text fg={theme.text}>
                <b>Location</b>
              </text>
              <text fg={theme.textMuted}>{shortDir()}</text>
              <Show when={gitBranch()}>
                <text fg={theme.textMuted}>
                  <span style={{ fg: theme.success }}>⎇</span> {gitBranch()}
                </text>
              </Show>
            </box>

            {/* Session title - show parent session when viewing subagent */}
            <box>
              <Show when={isShowingSubagent() && parentSession()} fallback={
                <>
                  <text fg={theme.text}>
                    <b>{session()?.title}</b>
                  </text>
                  <text fg={theme.textMuted}>
                    {session() ? Locale.todayTimeOrDateTime(session().time.created) : ""}
                  </text>
                  <Show when={session()?.share?.url}>
                    <text fg={theme.textMuted}>{session().share!.url}</text>
                  </Show>
                </>
              }>
                <text fg={theme.textMuted}>
                  <span style={{ fg: theme.primary }}>◆</span> Parent: {parentSession()?.title}
                </text>
              </Show>
            </box>
            <box>
              <text fg={theme.text}>
                <b>Session Tokens</b>
              </text>
              <text fg={theme.textMuted}>
                Last: {context()?.currentFormatted ?? "0"} | Total: {context()?.cumulativeFormatted ?? "0"}
              </text>
              <Show when={context()?.percentage && context()?.limit}>
                <text fg={context()!.percentage! > 80 ? theme.warning : theme.textMuted}>
                  Context: {context()?.percentage}% of {context()?.limit}
                </text>
              </Show>
              <Show when={cost() !== "$0.00"}>
                <text fg={theme.textMuted}>{cost()} (if not Max)</text>
              </Show>
            </box>
            <Show when={mcpEntries().length > 0}>
              <box>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => mcpEntries().length > 2 && setExpanded("mcp", !expanded.mcp)}
                >
                  <Show when={mcpEntries().length > 2}>
                    <text fg={theme.text}>{expanded.mcp ? "▼" : "▶"}</text>
                  </Show>
                  <text fg={theme.text}>
                    <b>MCP</b>
                  </text>
                </box>
                <Show when={mcpEntries().length <= 2 || expanded.mcp}>
                  <For each={mcpEntries()}>
                    {([key, item]) => (
                      <box flexDirection="row" gap={1}>
                        <text
                          flexShrink={0}
                          style={{
                            fg: (
                              {
                                connected: theme.success,
                                failed: theme.error,
                                disabled: theme.textMuted,
                                needs_auth: theme.warning,
                                needs_client_registration: theme.error,
                              } as Record<string, typeof theme.success>
                            )[item.status],
                          }}
                        >
                          •
                        </text>
                        <text fg={theme.text} wrapMode="word">
                          {key}{" "}
                          <span style={{ fg: theme.textMuted }}>
                            <Switch fallback={item.status}>
                              <Match when={item.status === "connected"}>Connected</Match>
                              <Match when={item.status === "failed" && item}>{(val) => <i>{val().error}</i>}</Match>
                              <Match when={item.status === "disabled"}>Disabled</Match>
                              <Match when={(item.status as string) === "needs_auth"}>Needs auth</Match>
                              <Match when={(item.status as string) === "needs_client_registration"}>
                                Needs client ID
                              </Match>
                            </Switch>
                          </span>
                        </text>
                      </box>
                    )}
                  </For>
                </Show>
              </box>
            </Show>
            <box>
              <box
                flexDirection="row"
                gap={1}
                onMouseDown={() => sync.data.lsp.length > 2 && setExpanded("lsp", !expanded.lsp)}
              >
                <Show when={sync.data.lsp.length > 2}>
                  <text fg={theme.text}>{expanded.lsp ? "▼" : "▶"}</text>
                </Show>
                <text fg={theme.text}>
                  <b>LSP</b>
                </text>
              </box>
              <Show when={sync.data.lsp.length <= 2 || expanded.lsp}>
                <Show when={sync.data.lsp.length === 0}>
                  <text fg={theme.textMuted}>LSPs will activate as files are read</text>
                </Show>
                <For each={sync.data.lsp}>
                  {(item) => (
                    <box flexDirection="row" gap={1}>
                      <text
                        flexShrink={0}
                        style={{
                          fg: {
                            connected: theme.success,
                            error: theme.error,
                          }[item.status],
                        }}
                      >
                        •
                      </text>
                      <text fg={theme.textMuted}>
                        {item.id} {item.root}
                      </text>
                    </box>
                  )}
                </For>
              </Show>
            </box>
            {/* Todo section - ALWAYS visible so user can track Claude's work */}
            <box>
              <box
                flexDirection="row"
                gap={1}
                onMouseDown={() => todo().length > 2 && setExpanded("todo", !expanded.todo)}
              >
                <Show when={todo().length > 2}>
                  <text fg={theme.text}>{expanded.todo ? "▼" : "▶"}</text>
                </Show>
                <text fg={theme.text}>
                  <b>Todo</b>
                  <Show when={todo().length > 0}>
                    <span style={{ fg: theme.textMuted }}> ({todo().filter(t => t.status !== "completed").length}/{todo().length})</span>
                  </Show>
                </text>
              </box>
              <Show 
                when={todo().length > 0}
                fallback={
                  <box>
                    <text fg={theme.textMuted}>
                      <i>░░ No active tasks ░░</i>
                    </text>
                    <text fg={theme.textMuted}>
                      Claude will add tasks here
                    </text>
                    <text fg={theme.textMuted}>
                      when working on complex work
                    </text>
                  </box>
                }
              >
                <Show when={todo().length <= 2 || expanded.todo}>
                  <For each={todo()}>
                    {(item, index) => {
                      // Find the first pending item to distinguish "next up" from "future"
                      const firstPendingIndex = todo().findIndex((t) => t.status === "pending")
                      const isNextPending = item.status === "pending" && index() === firstPendingIndex
                      
                      // Different colors for different states
                      // in_progress: bright green (active work)
                      // pending (next): light green/cyan (up next)  
                      // pending (future): dimmer green/teal (queued)
                      // completed: muted (done)
                      // cancelled: red (stopped)
                      const getStyle = () => {
                        switch (item.status) {
                          case "in_progress":
                            return { fg: "#50fa7b", bold: true } // Bright green - active
                          case "pending":
                            if (isNextPending) {
                              return { fg: "#8be9fd", bold: false } // Cyan - next up
                            }
                            return { fg: "#6272a4", bold: false } // Muted blue/purple - future tasks
                          case "completed":
                            return { fg: theme.textMuted, bold: false }
                          case "cancelled":
                            return { fg: theme.error, bold: false }
                          default:
                            return { fg: theme.textMuted, bold: false }
                        }
                      }
                      const style = getStyle()
                      const icon = item.status === "completed" ? "✓" : item.status === "in_progress" ? "►" : item.status === "cancelled" ? "✗" : isNextPending ? "◆" : "○"
                      return (
                        <text style={{ fg: style.fg }}>
                          {style.bold ? <b>[{icon}] {item.content}</b> : <>[{icon}] {item.content}</>}
                        </text>
                      )
                    }}
                  </For>
                </Show>
              </Show>
            </box>
            {/* Chat Branches/Forks Section */}
            <Show when={sessionFamily().parent || sessionFamily().siblings.length > 0 || sessionFamily().children.length > 0}>
              <box>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => setExpanded("branches", !expanded.branches)}
                >
                  <text fg={theme.text}>{expanded.branches ? "▼" : "▶"}</text>
                  <text fg={theme.text}>
                    <b>Branches</b>
                    <span style={{ fg: theme.textMuted }}> ({sessionFamily().siblings.length + sessionFamily().children.length + (sessionFamily().parent ? 1 : 0)})</span>
                  </text>
                </box>
                <Show when={expanded.branches}>
                  {/* Parent session (if this is a fork) */}
                  <Show when={sessionFamily().parent}>
                    <box 
                      flexDirection="row" 
                      gap={1}
                      onMouseDown={() => {
                        const parent = sessionFamily().parent
                        if (parent) {
                          route.navigate({ type: "session", sessionID: parent.id })
                        }
                      }}
                    >
                      <text fg={theme.textMuted}>↑</text>
                      <text fg="#8be9fd">
                        {sessionFamily().parent!.title?.slice(0, 25) || "Parent"}
                      </text>
                    </box>
                  </Show>
                  {/* Current session indicator */}
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.success}>●</text>
                    <text fg={theme.success}>
                      <b>{session()?.title?.slice(0, 25) || "Current"}</b>
                    </text>
                  </box>
                  {/* Sibling sessions (other forks from same parent) */}
                  <For each={sessionFamily().siblings}>
                    {(sibling) => (
                      <box 
                        flexDirection="row" 
                        gap={1}
                        onMouseDown={() => route.navigate({ type: "session", sessionID: sibling.id })}
                      >
                        <text fg={theme.textMuted}>├</text>
                        <text fg="#ff79c6">
                          {sibling.title?.slice(0, 25) || "Fork"}
                        </text>
                      </box>
                    )}
                  </For>
                  {/* Child sessions (forks from this session) */}
                  <For each={sessionFamily().children}>
                    {(child) => (
                      <box 
                        flexDirection="row" 
                        gap={1}
                        onMouseDown={() => route.navigate({ type: "session", sessionID: child.id })}
                      >
                        <text fg={theme.textMuted}>└→</text>
                        <text fg="#50fa7b">
                          {child.title?.slice(0, 25) || "Child"}
                        </text>
                      </box>
                    )}
                  </For>
                </Show>
              </box>
            </Show>
            <Show when={diff().length > 0}>
              <box>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => diff().length > 2 && setExpanded("diff", !expanded.diff)}
                >
                  <Show when={diff().length > 2}>
                    <text fg={theme.text}>{expanded.diff ? "▼" : "▶"}</text>
                  </Show>
                  <text fg={theme.text}>
                    <b>Modified Files</b>
                  </text>
                </box>
                <Show when={diff().length <= 2 || expanded.diff}>
                  <For each={diff() || []}>
                    {(item) => {
                      const file = createMemo(() => {
                        const splits = item.file.split(path.sep).filter(Boolean)
                        const last = splits.at(-1)!
                        const rest = splits.slice(0, -1).join(path.sep)
                        if (!rest) return last
                        return Locale.truncateMiddle(rest, 30 - last.length) + "/" + last
                      })
                      return (
                        <box flexDirection="row" gap={1} justifyContent="space-between">
                          <text fg={theme.textMuted} wrapMode="char">
                            {file()}
                          </text>
                          <box flexDirection="row" gap={1} flexShrink={0}>
                            <Show when={item.additions}>
                              <text fg={theme.diffAdded}>+{item.additions}</text>
                            </Show>
                            <Show when={item.deletions}>
                              <text fg={theme.diffRemoved}>-{item.deletions}</text>
                            </Show>
                          </box>
                        </box>
                      )
                    }}
                  </For>
                </Show>
              </box>
            </Show>
          </box>
        </scrollbox>

        <box flexShrink={0} gap={1} paddingTop={1}>
          <Show when={!hasProviders()}>
            <box
              backgroundColor={theme.backgroundElement}
              paddingTop={1}
              paddingBottom={1}
              paddingLeft={2}
              paddingRight={2}
              flexDirection="row"
              gap={1}
            >
              <text flexShrink={0}>⬖</text>
              <box flexGrow={1} gap={1}>
                <text>
                  <b>Getting started</b>
                </text>
                <text fg={theme.textMuted}>Qalarc includes free models so you can start immediately.</text>
                <text fg={theme.textMuted}>
                  Connect from 75+ providers to use other models, including Claude, GPT, Gemini etc
                </text>
                <box flexDirection="row" gap={1} justifyContent="space-between">
                  <text>Connect provider</text>
                  <text fg={theme.textMuted}>/connect</text>
                </box>
              </box>
            </box>
          </Show>
          <text fg={theme.text}>{directory()}</text>
          <text fg={theme.textMuted}>
            <span style={{ fg: theme.success }}>•</span> <b>Qal</b>
            <span style={{ fg: theme.accent }}>
              <b>arc</b>
            </span>{" "}
            <span>{Installation.VERSION}</span>
          </text>
        </box>
      </box>
    </Show>
  )
}
