/**
 * @command /nhay
 * @category Quản trị
 * @author DxTDz
 * @date 2024-03-15
 * @usage /nhay [uid1] [uid2] [uid3]...
 * @description Gửi nội dung từ file nhay.txt và tag nhiều người liên tục. Dùng /nhayoff để dừng.
 */

const fs = require('fs');
const path = require('path');

// Lưu trạng thái theo chatId (mỗi nhóm có trạng thái riêng)
const sendingStates = new Map();
const delay = 3000; // 3 giây

module.exports = (bot, config) => {
  // Lệnh /nhay để bắt đầu gửi (chỉ admin)
  bot.onText(/\/nhay(?:\s+(\d+))+/g, (msg, match) => {
    const chatId = msg.chat.id;
    
    // KIỂM TRA ADMIN TỪ CONFIG (theo cấu trúc của index.js)
    if (!config || !config.adminId || msg.from.id.toString() !== config.adminId.toString()) {
      return bot.sendMessage(chatId, '❌ Chỉ admin mới được sử dụng lệnh này!');
    }
    
    // Nếu đang gửi trong chat này thì báo lỗi
    if (sendingStates.has(chatId)) {
      return bot.sendMessage(chatId, '⚠️ Bot đang trong chế độ gửi trong chat này. Dùng /nhayoff để dừng trước.');
    }
    
    // Lấy tất cả UID từ lệnh (bỏ phần "/nhay")
    const uids = match.slice(1).filter(uid => uid).map(uid => parseInt(uid));
    
    if (uids.length === 0) {
      return bot.sendMessage(chatId, '⚠️ Vui lòng nhập ít nhất 1 UID!\nVí dụ: /nhay 123456789 987654321');
    }
    
    // Đọc nội dung từ file nhay.txt
    const filePath = path.join(__dirname, '../nhay.txt');
    let content = "🎯 Nội dung từ file nhay.txt!";
    
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (fileContent.trim()) {
          content = fileContent;
        }
      } catch (error) {
        console.error('Lỗi đọc file nhay.txt:', error);
      }
    } else {
      // Tạo file mẫu nếu chưa có
      fs.writeFileSync(filePath, '🎯 Nội dung mẫu từ file nhay.txt!\nHãy tag @user tại đây!');
    }
    
    // Tạo trạng thái gửi cho chat này
    sendingStates.set(chatId, {
      active: true,
      uids: uids,
      content: content,
      messageCount: 0,
      intervalId: null
    });
    
    // Hiển thị thông báo bắt đầu
    const uidList = uids.map(uid => `👤 ${uid}`).join('\n');
    bot.sendMessage(chatId, 
      `✅ Đã bắt đầu chế độ gửi!\n\n📁 File: nhay.txt\n📊 Số người tag: ${uids.length}\n⏱ Delay: 3s\n\n${uidList}\n\n🛑 Dùng /nhayoff để dừng.`);
    
    // Hàm gửi tin nhắn
    const sendMessage = () => {
      const state = sendingStates.get(chatId);
      if (!state || !state.active) return;
      
      let messageContent = state.content;
      let tags = "";
      
      // Tạo tag cho tất cả UID
      state.uids.forEach((uid, index) => {
        // Thay thế @user, @user1, @user2, ...
        const placeholder = index === 0 ? '@user' : `@user${index + 1}`;
        if (messageContent.includes(placeholder)) {
          messageContent = messageContent.replace(new RegExp(placeholder, 'g'), 
            `[👤](tg://user?id=${uid})`);
        }
        
        // Thêm tag vào cuối tin nhắn
        tags += `[👤${index + 1}](tg://user?id=${uid}) `;
      });
      
      // Nếu không có placeholder, thêm tag vào cuối
      const finalMessage = messageContent.includes('[👤]') 
        ? messageContent 
        : `${messageContent}\n\n${tags}`;
      
      // Gửi tin nhắn
      bot.sendMessage(chatId, `${finalMessage}\n\n#${state.messageCount + 1}`, {
        parse_mode: 'Markdown',
        disable_notification: false
      });
      
      // Cập nhật số tin đã gửi
      state.messageCount++;
      sendingStates.set(chatId, state);
    };
    
    // Gửi ngay lần đầu
    sendMessage();
    
    // Thiết lập interval để gửi tiếp
    const intervalId = setInterval(sendMessage, delay);
    const state = sendingStates.get(chatId);
    state.intervalId = intervalId;
    sendingStates.set(chatId, state);
  });
  
  // Lệnh /nhayoff để dừng gửi (chỉ admin)
  bot.onText(/\/nhayoff/, (msg) => {
    const chatId = msg.chat.id;
    
    // KIỂM TRA ADMIN TỪ CONFIG (theo cấu trúc của index.js)
    if (!config || !config.adminId || msg.from.id.toString() !== config.adminId.toString()) {
      return bot.sendMessage(chatId, '❌ Chỉ admin mới được sử dụng lệnh này!');
    }
    
    const state = sendingStates.get(chatId);
    
    if (!state) {
      return bot.sendMessage(chatId, 'ℹ️ Bot không trong chế độ gửi trong chat này.');
    }
    
    // Dừng gửi
    state.active = false;
    if (state.intervalId) {
      clearInterval(state.intervalId);
    }
    sendingStates.delete(chatId);
    
    bot.sendMessage(chatId, 
      `🛑 Đã dừng chế độ gửi!\n📊 Tổng số tin đã gửi: ${state.messageCount}\n👤 Số người được tag: ${state.uids.length}`);
  });
  
  // Xử lý khi bot bị dừng đột ngột
  process.on('SIGINT', () => {
    sendingStates.forEach((state, chatId) => {
      if (state.intervalId) {
        clearInterval(state.intervalId);
      }
    });
    process.exit(0);
  });
};
