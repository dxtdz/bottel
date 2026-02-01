/**
 * @command /taixiu
 * @category Giải trí
 * @author DxTDz
 * @date 2024-03-15
 * @usage /taixiu [tài/xỉu/bao] [số tiền]
 * @description Game tài xỉu với hệ thống ngân hàng, chuyển tiền và admin cấp tiền.
 */

const fs = require('fs');
const path = require('path');

// File lưu dữ liệu
const DATA_FILE = path.join(__dirname, '../taixiu_data.json');

// Cấu hình game
const GAME_CONFIG = {
    minBet: 100,
    maxBet: 1000000,
    defaultMoney: 10000,
    adminId: null,
    taxRate: 0.05, // 5% thuế chuyển tiền
    maxRequest: 50000 // Tối đa xin tiền
};

// Đọc dữ liệu
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Lỗi đọc dữ liệu tài xỉu:', error);
    }
    return { players: {}, bank: {}, transactions: [] };
}

// Lưu dữ liệu
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Lỗi lưu dữ liệu tài xỉu:', error);
        return false;
    }
}

// Hàm xúc xắc
function rollDice() {
    return [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
    ];
}

// Tính kết quả
function calculateResult(dice) {
    const sum = dice.reduce((a, b) => a + b, 0);
    const isTai = sum >= 11 && sum <= 17;
    const isXiu = sum >= 4 && sum <= 10;
    const isBao = dice[0] === dice[1] && dice[1] === dice[2];
    
    return {
        dice,
        sum,
        isTai,
        isXiu,
        isBao,
        result: isBao ? 'BÃO' : (isTai ? 'TÀI' : 'XỈU')
    };
}

// Format số tiền
function formatMoney(amount) {
    return amount.toLocaleString('vi-VN') + ' coins';
}

// Lấy dice emoji
function getDiceEmoji(dice) {
    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return dice.map(d => diceEmojis[d-1] || '🎲').join(' ');
}

module.exports = (bot, config) => {
    // Set admin ID từ config
    GAME_CONFIG.adminId = config.adminId;
    
    let gameData = loadData();
    
    // Khởi tạo cấu trúc nếu chưa có
    if (!gameData.players) gameData.players = {};
    if (!gameData.bank) gameData.bank = {};
    if (!gameData.transactions) gameData.transactions = [];
    
    // ========== HÀM TIỆN ÍCH ==========
    
    // Lấy hoặc tạo người chơi
    function getPlayer(userId) {
        if (!gameData.players[userId]) {
            gameData.players[userId] = {
                money: GAME_CONFIG.defaultMoney,
                bankMoney: 0,
                win: 0,
                lose: 0,
                totalBet: 0,
                lastPlay: null,
                totalEarned: 0,
                totalLost: 0,
                displayName: '',
                username: ''
            };
        }
        return gameData.players[userId];
    }
    
    // Cập nhật thông tin người chơi
    function updatePlayerInfo(userId, userData) {
        const player = getPlayer(userId);
        if (!player.displayName && userData.first_name) {
            player.displayName = userData.first_name + (userData.last_name ? ' ' + userData.last_name : '');
        }
        if (!player.username && userData.username) {
            player.username = userData.username;
        }
    }
    
    // Lưu giao dịch
    function saveTransaction(type, fromId, toId, amount, note = '') {
        const transaction = {
            id: Date.now().toString(),
            type,
            fromId,
            toId,
            amount,
            tax: type === 'transfer' ? amount * GAME_CONFIG.taxRate : 0,
            note,
            timestamp: new Date().toISOString()
        };
        
        gameData.transactions.unshift(transaction);
        if (gameData.transactions.length > 100) {
            gameData.transactions = gameData.transactions.slice(0, 100);
        }
        
        return transaction;
    }
    
    // ========== LỆNH TÀI XỈU ==========
    
    bot.onText(/\/taixiu(?:\s+(tài|xỉu|bao)?\s*(\d+)?)?/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const choice = match[1] ? match[1].toLowerCase() : null;
        const betAmount = match[2] ? parseInt(match[2]) : null;
        
        updatePlayerInfo(userId, msg.from);
        const player = getPlayer(userId);
        
        // Hiển thị thông tin nếu không có lựa chọn
        if (!choice) {
            const stats = [
                `🎲 **Game Tài Xỉu**`,
                `👤 Người chơi: ${player.displayName || 'Ẩn danh'}`,
                player.username ? `📱 Username: @${player.username}` : '',
                `💰 Tiền mặt: **${formatMoney(player.money)}**`,
                `🏦 Ngân hàng: **${formatMoney(player.bankMoney)}**`,
                `📊 Thống kê: ${player.win}✓ ${player.lose}✗`,
                `📈 Tổng lời: ${formatMoney(player.totalEarned - player.totalLost)}`,
                '',
                `📝 **Cách chơi:**`,
                `\`/taixiu tài 1000\` - Cược 1000 vào TÀI`,
                `\`/taixiu xỉu 500\` - Cược 500 vào XỈU`,
                `\`/taixiu bao 2000\` - Cược 2000 vào BÃO`,
                '',
                `⚡ **Luật chơi:**`,
                `• Xỉu: Tổng 4-10 điểm`,
                `• Tài: Tổng 11-17 điểm`,
                `• Bão: 3 mặt giống nhau (thắng x3)`,
                `• Min cược: ${formatMoney(GAME_CONFIG.minBet)}`,
                `• Max cược: ${formatMoney(GAME_CONFIG.maxBet)}`,
                '',
                `💳 **Lệnh khác:**`,
                `• \`/money\` - Xem số dư`,
                `• \`/bank nop 1000\` - Gửi tiền`,
                `• \`/bank rut 500\` - Rút tiền`,
                `• \`/anxin 1000\` - Xin tiền`,
                `• \`/top\` - Bảng xếp hạng`,
                `• \`/chuyen @user 1000\` - Chuyển tiền`
            ].filter(line => line !== '').join('\n');
            
            return bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
        }
        
        // Kiểm tra lựa chọn hợp lệ
        if (!['tài', 'xỉu', 'bao'].includes(choice)) {
            return bot.sendMessage(chatId, '❌ Lựa chọn không hợp lệ! Chọn "tài", "xỉu" hoặc "bao"');
        }
        
        // Kiểm tra số tiền
        if (!betAmount || betAmount < GAME_CONFIG.minBet) {
            return bot.sendMessage(chatId, `❌ Số tiền tối thiểu là ${formatMoney(GAME_CONFIG.minBet)}!`);
        }
        
        if (betAmount > GAME_CONFIG.maxBet) {
            return bot.sendMessage(chatId, `❌ Số tiền tối đa là ${formatMoney(GAME_CONFIG.maxBet)}!`);
        }
        
        // Kiểm tra đủ tiền
        if (player.money < betAmount) {
            return bot.sendMessage(chatId,
                `❌ Bạn không đủ tiền!\n` +
                `💰 Hiện có: ${formatMoney(player.money)}\n` +
                `💵 Cần thêm: ${formatMoney(betAmount - player.money)}\n\n` +
                `📌 Dùng lệnh:\n` +
                `• \`/anxin ${betAmount - player.money}\` - Xin tiền\n` +
                `• \`/bank rut ${betAmount - player.money}\` - Rút từ ngân hàng`,
                { parse_mode: 'Markdown' }
            );
        }
        
        try {
            // Trừ tiền cược
            player.money -= betAmount;
            player.totalBet += betAmount;
            
            // Gửi thông báo đang xử lý
            const processingMsg = await bot.sendMessage(chatId, 
                `🎲 **Đang lắc xúc xắc...**\n` +
                `👤 Người chơi: ${player.displayName || 'Ẩn danh'}\n` +
                `🎯 Lựa chọn: ${choice.toUpperCase()}\n` +
                `💰 Tiền cược: ${formatMoney(betAmount)}`,
                { parse_mode: 'Markdown' }
            );
            
            // Đợi 2 giây cho kịch tính
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Lắc xúc xắc
            const dice = rollDice();
            const result = calculateResult(dice);
            
            // Tính thắng thua
            let win = false;
            let multiplier = 1;
            
            if (choice === 'bao' && result.isBao) {
                win = true;
                multiplier = 3; // Bão thắng gấp 3
            } else if (choice === 'tài' && result.isTai && !result.isBao) {
                win = true;
                multiplier = 1;
            } else if (choice === 'xỉu' && result.isXiu && !result.isBao) {
                win = true;
                multiplier = 1;
            }
            
            // Tính tiền thắng
            let winAmount = 0;
            
            if (win) {
                winAmount = betAmount * multiplier;
                player.money += winAmount;
                player.win += 1;
                player.totalEarned += (winAmount - betAmount);
            } else {
                player.lose += 1;
                player.totalLost += betAmount;
            }
            
            // Cập nhật thời gian chơi
            player.lastPlay = new Date().toISOString();
            
            // Lưu dữ liệu
            saveData(gameData);
            
            // Tạo tin nhắn kết quả
            const diceEmojis = getDiceEmoji(dice);
            let message = '';
            
            if (win) {
                message += `🎉 **CHÚC MỪNG! BẠN ĐÃ THẮNG!**\n\n`;
            } else {
                message += `😢 **RẤT TIẾC! BẠN ĐÃ THUA!**\n\n`;
            }
            
            message += 
                `🎲 Xúc xắc: ${diceEmojis}\n` +
                `📊 Tổng điểm: **${result.sum}** (${result.result})\n` +
                `🎯 Bạn chọn: **${choice.toUpperCase()}**\n` +
                `💰 Tiền cược: ${formatMoney(betAmount)}\n`;
            
            if (win) {
                message += `💰 Tiền thắng: **${formatMoney(winAmount)}** (x${multiplier})\n`;
            }
            
            message += 
                `\n📊 **Số dư mới:**\n` +
                `💵 Tiền mặt: **${formatMoney(player.money)}**\n` +
                `🏦 Ngân hàng: ${formatMoney(player.bankMoney)}\n` +
                `📈 Lời/Lỗ: ${formatMoney(player.totalEarned - player.totalLost)}`;
            
            // Gửi kết quả
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'Markdown'
            });
            
        } catch (error) {
            console.error('Lỗi game tài xỉu:', error);
            bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi chơi game!');
        }
    });
    
    // ========== LỆNH ADDMONEY (ADMIN) ==========
    
    bot.onText(/\/addmoney(?:\s+(?:@(\w+)|(\d+)))?\s+(\d+)/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const adminId = msg.from.id.toString();
        const targetUsername = match[1]; // @username
        const targetUserId = match[2];   // user_id
        const amount = parseInt(match[3]);
        
        // Chỉ admin được dùng
        if (adminId !== GAME_CONFIG.adminId) {
            return bot.sendMessage(chatId, '❌ Chỉ admin mới được cấp tiền!');
        }
        
        if (!amount || amount <= 0) {
            return bot.sendMessage(chatId, '❌ Số tiền không hợp lệ!');
        }
        
        if (amount > 10000000) {
            return bot.sendMessage(chatId, '❌ Tối đa 10,000,000 coins mỗi lần!');
        }
        
        let targetId = null;
        let targetName = '';
        
        // Xác định người nhận
        if (targetUsername) {
            // Tìm user ID từ username (đơn giản hóa)
            // Trong thực tế cần lưu mapping username -> user_id
            return bot.sendMessage(chatId,
                `⚠️ Đang tìm user @${targetUsername}...\n\n` +
                `📌 Tạm thời dùng User ID thay vì username.\n` +
                `💡 Dùng: \`/addmoney 123456789 1000\``,
                { parse_mode: 'Markdown' }
            );
        } else if (targetUserId) {
            targetId = targetUserId;
            // Cố gắng lấy thông tin user
            try {
                const userInfo = await bot.getChat(targetUserId);
                targetName = userInfo.first_name || 'Người chơi';
            } catch (error) {
                targetName = `User ${targetUserId}`;
            }
        } else {
            // Tự cấp cho chính mình
            targetId = adminId;
            targetName = 'Bạn';
        }
        
        if (!targetId) {
            return bot.sendMessage(chatId, '❌ Không tìm thấy người nhận!');
        }
        
        // Cấp tiền
        const targetPlayer = getPlayer(targetId);
        targetPlayer.money += amount;
        
        // Lưu giao dịch
        saveTransaction('admin_add', adminId, targetId, amount, `Admin cấp tiền`);
        
        saveData(gameData);
        
        bot.sendMessage(chatId,
            `✅ **ĐÃ CẤP TIỀN THÀNH CÔNG!**\n\n` +
            `👤 Người nhận: ${targetName}\n` +
            `💰 Số tiền: ${formatMoney(amount)}\n` +
            `💵 Số dư mới: ${formatMoney(targetPlayer.money)}\n\n` +
            `👑 Admin: ${msg.from.first_name}`,
            { parse_mode: 'Markdown' }
        );
    });
    
    // ========== LỆNH BANK ==========
    
    bot.onText(/\/bank(?:\s+(nop|rut|gui|chuyển|rút|gửi|nap))?\s*(\d+)?/i, (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const action = match[1] ? match[1].toLowerCase() : null;
        const amount = match[2] ? parseInt(match[2]) : null;
        
        updatePlayerInfo(userId, msg.from);
        const player = getPlayer(userId);
        
        // Hiển thị menu nếu không có action
        if (!action) {
            const bankInfo = [
                `🏦 **NGÂN HÀNG GAME**`,
                `👤 Chủ tài khoản: ${player.displayName || 'Ẩn danh'}`,
                `💰 **Số dư hiện tại:**`,
                `💵 Tiền mặt: **${formatMoney(player.money)}**`,
                `🏦 Ngân hàng: **${formatMoney(player.bankMoney)}**`,
                `💰 Tổng tài sản: **${formatMoney(player.money + player.bankMoney)}**`,
                '',
                `📝 **Lệnh ngân hàng:**`,
                `\`/bank nop 1000\` - Nộp/Gửi tiền vào ngân hàng`,
                `\`/bank rut 500\` - Rút tiền từ ngân hàng`,
                '',
                `⚠️ **Lưu ý:**`,
                `• Tiền trong ngân hàng an toàn hơn`,
                `• Không thể chơi game bằng tiền ngân hàng`,
                `• Rút tiền mới có thể chơi game`
            ].join('\n');
            
            return bot.sendMessage(chatId, bankInfo, { parse_mode: 'Markdown' });
        }
        
        // Kiểm tra số tiền
        if (!amount || amount <= 0) {
            return bot.sendMessage(chatId, '❌ Số tiền không hợp lệ!');
        }
        
        // Xử lý các action
        const actionMap = {
            'nop': 'nop', 'nap': 'nop', 'gui': 'nop', 'gửi': 'nop',
            'rut': 'rut', 'rút': 'rut', 'chuyển': 'rut'
        };
        
        const realAction = actionMap[action] || action;
        
        if (realAction === 'nop' || realAction === 'gui') {
            // Gửi tiền vào ngân hàng
            if (player.money < amount) {
                return bot.sendMessage(chatId, 
                    `❌ Không đủ tiền mặt!\n` +
                    `💵 Cần: ${formatMoney(amount)}\n` +
                    `💰 Có: ${formatMoney(player.money)}`
                );
            }
            
            player.money -= amount;
            player.bankMoney += amount;
            
            // Lưu giao dịch
            saveTransaction('bank_deposit', userId, 'bank', amount, 'Nộp tiền vào ngân hàng');
            
            saveData(gameData);
            
            bot.sendMessage(chatId,
                `✅ **ĐÃ NỘP TIỀN VÀO NGÂN HÀNG!**\n\n` +
                `💰 Số tiền: ${formatMoney(amount)}\n` +
                `💵 Tiền mặt còn: ${formatMoney(player.money)}\n` +
                `🏦 Tiền ngân hàng: ${formatMoney(player.bankMoney)}\n\n` +
                `📅 ${new Date().toLocaleDateString('vi-VN')}`,
                { parse_mode: 'Markdown' }
            );
            
        } else if (realAction === 'rut') {
            // Rút tiền từ ngân hàng
            if (player.bankMoney < amount) {
                return bot.sendMessage(chatId,
                    `❌ Không đủ tiền trong ngân hàng!\n` +
                    `🏦 Cần: ${formatMoney(amount)}\n` +
                    `💰 Có: ${formatMoney(player.bankMoney)}`
                );
            }
            
            player.bankMoney -= amount;
            player.money += amount;
            
            // Lưu giao dịch
            saveTransaction('bank_withdraw', 'bank', userId, amount, 'Rút tiền từ ngân hàng');
            
            saveData(gameData);
            
            bot.sendMessage(chatId,
                `✅ **ĐÃ RÚT TIỀN TỪ NGÂN HÀNG!**\n\n` +
                `💰 Số tiền: ${formatMoney(amount)}\n` +
                `💵 Tiền mặt: ${formatMoney(player.money)}\n` +
                `🏦 Ngân hàng còn: ${formatMoney(player.bankMoney)}\n\n` +
                `📅 ${new Date().toLocaleDateString('vi-VN')}`,
                { parse_mode: 'Markdown' }
            );
        }
    });
    
    // ========== LỆNH ANXIN (XIN TIỀN) ==========
    
    bot.onText(/\/anxin\s+(\d+)/i, (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const amount = parseInt(match[1]);
        
        updatePlayerInfo(userId, msg.from);
        const player = getPlayer(userId);
        
        if (!amount || amount <= 0) {
            return bot.sendMessage(chatId, '❌ Số tiền không hợp lệ!\nVD: `/anxin 1000`', { parse_mode: 'Markdown' });
        }
        
        if (amount > GAME_CONFIG.maxRequest) {
            return bot.sendMessage(chatId, 
                `❌ Chỉ được xin tối đa ${formatMoney(GAME_CONFIG.maxRequest)} mỗi lần!`
            );
        }
        
        // Kiểm tra thời gian xin lần cuối
        const now = new Date();
        const lastRequest = gameData.bank[userId] ? new Date(gameData.bank[userId].lastRequest) : null;
        
        if (lastRequest && (now - lastRequest) < 3600000) { // 1 giờ
            const minutesLeft = Math.ceil((3600000 - (now - lastRequest)) / 60000);
            return bot.sendMessage(chatId, 
                `⏰ Bạn đã xin tiền gần đây!\n` +
                `🕒 Chờ thêm ${minutesLeft} phút nữa.`
            );
        }
        
        // Cấp tiền
        player.money += amount;
        
        // Lưu lịch sử xin
        if (!gameData.bank[userId]) {
            gameData.bank[userId] = { totalRequested: 0, lastRequest: null };
        }
        gameData.bank[userId].totalRequested += amount;
        gameData.bank[userId].lastRequest = now.toISOString();
        
        // Lưu giao dịch
        saveTransaction('system_grant', 'system', userId, amount, 'Xin tiền từ hệ thống');
        
        saveData(gameData);
        
        bot.sendMessage(chatId,
            `🙏 **ĐÃ NHẬN ĐƯỢC ${formatMoney(amount)} TỪ HỆ THỐNG!**\n\n` +
            `💵 Số dư mới: ${formatMoney(player.money)}\n` +
            `⏳ Có thể xin lại sau 1 giờ.\n\n` +
            `💡 *Chúc may mắn trong game!*`,
            { parse_mode: 'Markdown' }
        );
    });
    
    // ========== LỆNH MONEY ==========
    
    bot.onText(/\/money(?:\s+@(\w+))?/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const targetUsername = match[1];
        
        if (targetUsername) {
            // Xem thông tin người khác (đơn giản hóa)
            return bot.sendMessage(chatId,
                `👀 **Xem thông tin người khác**\n\n` +
                `📌 Tạm thời chỉ xem được thông tin của chính bạn.\n` +
                `💡 Dùng: \`/money\` để xem số dư của bạn.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        updatePlayerInfo(userId, msg.from);
        const player = getPlayer(userId);
        
        const stats = [
            `💰 **THÔNG TIN TÀI KHOẢN**`,
            `👤 Người chơi: ${player.displayName || 'Ẩn danh'}`,
            player.username ? `📱 @${player.username}` : '',
            `🆔 ID: ${userId}`,
            ``,
            `💵 **TIỀN MẶT:** ${formatMoney(player.money)}`,
            `🏦 **NGÂN HÀNG:** ${formatMoney(player.bankMoney)}`,
            `💰 **TỔNG TÀI SẢN:** ${formatMoney(player.money + player.bankMoney)}`,
            ``,
            `📊 **THỐNG KÊ GAME:**`,
            `🎯 Thắng/Thua: ${player.win}✓ ${player.lose}✗`,
            `📈 Tổng lời: ${formatMoney(player.totalEarned - player.totalLost)}`,
            `🎲 Tổng cược: ${formatMoney(player.totalBet)}`,
            player.lastPlay ? `⏰ Chơi lần cuối: ${new Date(player.lastPlay).toLocaleDateString('vi-VN')}` : `⏰ Chưa chơi lần nào`,
            ``,
            `💳 **LỆNH NHANH:**`,
            `\`/bank nop 1000\` - Gửi tiền`,
            `\`/bank rut 500\` - Rút tiền`,
            `\`/anxin 1000\` - Xin tiền`,
            `\`/taixiu tài 1000\` - Chơi game`
        ].filter(line => line !== '').join('\n');
        
        bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
    });
    
    // ========== LỆNH TOP ==========
    
    bot.onText(/\/top/, (msg) => {
        const chatId = msg.chat.id;
        
        // Lấy top 10 người giàu nhất
        const players = Object.entries(gameData.players)
            .map(([id, data]) => ({
                id,
                displayName: data.displayName || `User ${id}`,
                username: data.username ? `@${data.username}` : '',
                totalMoney: data.money + data.bankMoney,
                ...data
            }))
            .sort((a, b) => b.totalMoney - a.totalMoney)
            .slice(0, 10);
        
        if (players.length === 0) {
            return bot.sendMessage(chatId, '📊 Chưa có dữ liệu xếp hạng!');
        }
        
        let topMessage = `🏆 **TOP 10 NGƯỜI GIÀU NHẤT**\n\n`;
        
        players.forEach((player, index) => {
            const medal = index === 0 ? '🥇' : 
                         index === 1 ? '🥈' : 
                         index === 2 ? '🥉' : 
                         `**${index + 1}.**`;
            
            const name = player.username || player.displayName;
            const shortName = name.length > 15 ? name.substring(0, 12) + '...' : name;
            
            topMessage += `${medal} **${formatMoney(player.totalMoney)}** - ${shortName}\n`;
        });
        
        topMessage += `\n📅 Cập nhật: ${new Date().toLocaleDateString('vi-VN')}`;
        
        bot.sendMessage(chatId, topMessage, { parse_mode: 'Markdown' });
    });
    
    // ========== LỆNH CHUYEN TIEN ==========
    
    bot.onText(/\/chuyen\s+@(\w+)\s+(\d+)/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const fromUserId = msg.from.id.toString();
        const toUsername = match[1];
        const amount = parseInt(match[2]);
        
        updatePlayerInfo(fromUserId, msg.from);
        const fromPlayer = getPlayer(fromUserId);
        
        if (!amount || amount <= 0) {
            return bot.sendMessage(chatId, '❌ Số tiền không hợp lệ!\nVD: `/chuyen @username 1000`', { parse_mode: 'Markdown' });
        }
        
        if (amount > 1000000) {
            return bot.sendMessage(chatId, '❌ Chỉ được chuyển tối đa 1,000,000 coins mỗi lần!');
        }
        
        // Kiểm tra đủ tiền
        if (fromPlayer.money < amount) {
            return bot.sendMessage(chatId,
                `❌ Không đủ tiền để chuyển!\n` +
                `💵 Cần: ${formatMoney(amount)}\n` +
                `💰 Có: ${formatMoney(fromPlayer.money)}\n\n` +
                `📌 Dùng lệnh:\n` +
                `• \`/bank rut ${amount - fromPlayer.money}\` - Rút thêm tiền\n` +
                `• \`/anxin ${amount - fromPlayer.money}\` - Xin tiền`
            );
        }
        
        // Tính thuế
        const tax = Math.floor(amount * GAME_CONFIG.taxRate);
        const netAmount = amount - tax;
        
        if (netAmount <= 0) {
            return bot.sendMessage(chatId, '❌ Số tiền sau thuế phải lớn hơn 0!');
        }
        
        // Tìm người nhận qua username (đơn giản hóa)
        // Trong thực tế cần có mapping username -> user_id
        bot.sendMessage(chatId,
            `📤 **CHUYỂN TIỀN CHO @${toUsername}**\n\n` +
            `💰 Số tiền: ${formatMoney(amount)}\n` +
            `🏛 Thuế (5%): ${formatMoney(tax)}\n` +
            `💵 Người nhận được: ${formatMoney(netAmount)}\n\n` +
            `⚠️ **Tính năng đang phát triển!**\n\n` +
            `📌 Tạm thời dùng User ID thay vì username.\n` +
            `💡 Liên hệ admin để được hỗ trợ.`,
            { parse_mode: 'Markdown' }
        );
    });
    
    // ========== LỆNH LỊCH SỬ ==========
    
    bot.onText(/\/lichsu/, (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        
        // Lấy 10 giao dịch gần nhất của user
        const userTransactions = gameData.transactions
            .filter(t => t.fromId === userId || t.toId === userId)
            .slice(0, 10);
        
        if (userTransactions.length === 0) {
            return bot.sendMessage(chatId, '📋 Bạn chưa có giao dịch nào!');
        }
        
        let historyMsg = `📋 **LỊCH SỬ GIAO DỊCH (10 gần nhất)**\n\n`;
        
        userTransactions.forEach((trans, index) => {
            const date = new Date(trans.timestamp).toLocaleDateString('vi-VN');
            const time = new Date(trans.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            
            let typeText = '';
            let amountText = '';
            
            switch(trans.type) {
                case 'admin_add':
                    typeText = '👑 Admin cấp';
                    amountText = `+${formatMoney(trans.amount)}`;
                    break;
                case 'system_grant':
                    typeText = '🎁 Hệ thống';
                    amountText = `+${formatMoney(trans.amount)}`;
                    break;
                case 'bank_deposit':
                    typeText = '🏦 Nộp ngân hàng';
                    amountText = `-${formatMoney(trans.amount)}`;
                    break;
                case 'bank_withdraw':
                    typeText = '🏦 Rút ngân hàng';
                    amountText = `+${formatMoney(trans.amount)}`;
                    break;
                case 'transfer':
                    if (trans.fromId === userId) {
                        typeText = '📤 Chuyển tiền';
                        amountText = `-${formatMoney(trans.amount)} (thuế: ${formatMoney(trans.tax)})`;
                    } else {
                        typeText = '📥 Nhận tiền';
                        amountText = `+${formatMoney(trans.amount - trans.tax)}`;
                    }
                    break;
                default:
                    typeText = trans.type;
                    amountText = formatMoney(trans.amount);
            }
            
            historyMsg += `${index + 1}. **${typeText}**\n`;
            historyMsg += `   💰 ${amountText}\n`;
            historyMsg += `   📅 ${date} ${time}\n`;
            if (trans.note) {
                historyMsg += `   📝 ${trans.note}\n`;
            }
            historyMsg += `\n`;
        });
        
        historyMsg += `📊 **Tổng số giao dịch:** ${userTransactions.length}`;
        
        bot.sendMessage(chatId, historyMsg, { parse_mode: 'Markdown' });
    });
    
    // ========== LỆNH RESET (ADMIN) ==========
    
    bot.onText(/\/resetmoney\s+(\d+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const adminId = msg.from.id.toString();
        const targetUserId = match[1];
        
        // Chỉ admin được dùng
        if (adminId !== GAME_CONFIG.adminId) {
            return bot.sendMessage(chatId, '❌ Chỉ admin mới được reset tiền!');
        }
        
        if (!gameData.players[targetUserId]) {
            return bot.sendMessage(chatId, '❌ Không tìm thấy người chơi!');
        }
        
        // Reset về mặc định
        gameData.players[targetUserId].money = GAME_CONFIG.defaultMoney;
        gameData.players[targetUserId].bankMoney = 0;
        gameData.players[targetUserId].win = 0;
        gameData.players[targetUserId].lose = 0;
        gameData.players[targetUserId].totalBet = 0;
        gameData.players[targetUserId].totalEarned = 0;
        gameData.players[targetUserId].totalLost = 0;
        
        // Lưu giao dịch
        saveTransaction('admin_reset', adminId, targetUserId, 0, 'Admin reset tài khoản');
        
        saveData(gameData);
        
        bot.sendMessage(chatId,
            `🔄 **ĐÃ RESET TÀI KHOẢN THÀNH CÔNG!**\n\n` +
            `👤 User ID: ${targetUserId}\n` +
            `💰 Số dư mới: ${formatMoney(GAME_CONFIG.defaultMoney)}\n\n` +
            `⚠️ Tất cả thống kê đã được reset về 0.`,
            { parse_mode: 'Markdown' }
        );
    });
    
    // ========== KHỞI TẠO VÀ AUTO SAVE ==========
    
    if (!fs.existsSync(DATA_FILE)) {
        saveData({ players: {}, bank: {}, transactions: [] });
        console.log('✅ Đã tạo file dữ liệu tài xỉu');
    }
    
    // Tự động lưu dữ liệu mỗi 5 phút
    setInterval(() => {
        saveData(gameData);
    }, 5 * 60 * 1000);
};
