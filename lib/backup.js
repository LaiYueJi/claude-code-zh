const fs = require('fs');

/**
 * 備份管理器：負責建立與還原原始英文備份（.bak）
 */
class BackupManager {
    constructor(config) {
        this.config = config;
    }

    backupPathFor(filePath) {
        return filePath + '.bak';
    }

    /** 建立備份檔（若已存在則不覆寫，避免把已翻譯內容當成原始英文備份） */
    async createBackup(filePath) {
        const backupPath = this.backupPathFor(filePath);
        try {
            if (fs.existsSync(backupPath)) {
                console.log('備份檔已存在，略過建立');
                return true;
            }
            fs.copyFileSync(filePath, backupPath);
            console.log('備份建立成功：', backupPath);
            return true;
        } catch (error) {
            console.error('備份建立失敗：', error);
            return false;
        }
    }

    /** 將備份還原回原檔 */
    async restoreBackup(filePath) {
        const backupPath = this.backupPathFor(filePath);
        try {
            if (!fs.existsSync(backupPath)) {
                console.log('備份檔不存在');
                return false;
            }
            fs.copyFileSync(backupPath, filePath);
            console.log('備份還原成功');
            return true;
        } catch (error) {
            console.error('備份還原失敗：', error);
            return false;
        }
    }

    /** 讀取原始英文備份內容（供冪等翻譯使用） */
    readBackup(filePath) {
        const backupPath = this.backupPathFor(filePath);
        if (!fs.existsSync(backupPath)) return null;
        return fs.readFileSync(backupPath, 'utf8');
    }

    /** 刪除備份檔 */
    async deleteBackup(filePath) {
        const backupPath = this.backupPathFor(filePath);
        try {
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
                console.log('備份檔已刪除');
                return true;
            }
            return false;
        } catch (error) {
            console.error('備份刪除失敗：', error);
            return false;
        }
    }

    /** 備份是否存在 */
    hasBackup(filePath) {
        return fs.existsSync(this.backupPathFor(filePath));
    }
}

module.exports = BackupManager;
