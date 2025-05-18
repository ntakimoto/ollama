from datetime import datetime
import matplotlib as plt
import pandas as pd
from pandas.plotting import register_matplotlib_converters
register_matplotlib_converters()
import MetaTrader5 as mt5
 
# MetaTrader 5に接続する
if not mt5.initialize():
   print("initialize() failed")
   mt5.shutdown()
   exit()

try:
    while True:
        # GBPJPYのティックデータを2023年1月1日から現在まで取得
        from_time = datetime(2023, 1, 1, 0)
        to_time = datetime.now()
        gbpjpy_ticks = mt5.copy_ticks_range("GBPJPY", from_time, to_time, mt5.COPY_TICKS_ALL)
        if gbpjpy_ticks is None:
            print("GBPJPYのティックデータが取得できませんでした。シンボルが有効か、日付・時刻が正しいか確認してください。")
            gbpjpy_ticks = []
        print('GBPJPY_ticks(', len(gbpjpy_ticks), ')')
        for val in gbpjpy_ticks[:100]: print(val)
        # USDJPYのティックデータも同様に取得
        usdjpy_ticks = mt5.copy_ticks_range("USDJPY", from_time, to_time, mt5.COPY_TICKS_ALL)
        if usdjpy_ticks is None:
            print("USDJPYのティックデータが取得できませんでした。シンボルが有効か、日付・時刻が正しいか確認してください。")
            usdjpy_ticks = []
        print('USDJPY_ticks(', len(usdjpy_ticks), ')')
        for val in usdjpy_ticks[:10]: print(val)
        # 1分ごとに再取得
        import time
        time.sleep(60)
except KeyboardInterrupt:
    print("mt5.py: 終了します。")
finally:
    mt5.shutdown()
 
# 数々の方法で異なる銘柄からバーを取得する
# eurusd_rates = mt5.copy_rates_from("EURUSD", mt5.TIMEFRAME_M1, datetime(2020,1,28,13), 1000)
# eurgbp_rates = mt5.copy_rates_from_pos("EURGBP", mt5.TIMEFRAME_M1, 0, 1000)
# eurcad_rates = mt5.copy_rates_range("EURCAD", mt5.TIMEFRAME_M1, datetime(2020,1,27,13), datetime(2020,1,28,13))
 
#データ
# print('eurusd_rates(', len(eurusd_rates), ')')
# for val in eurusd_rates[:10]: print(val)
 
# print('eurgbp_rates(', len(eurgbp_rates), ')')
# for val in eurgbp_rates[:10]: print(val)
 
# print('eurcad_rates(', len(eurcad_rates), ')')
# for val in eurcad_rates[:10]: print(val)
 
#PLOT
# 取得したデータからDataFrameを作成する
ticks_frame = pd.DataFrame(euraud_ticks)
# 秒での時間をdatetime形式に変換する
ticks_frame['time']=pd.to_datetime(ticks_frame['time'], unit='s')
# チャートにティックを表示する
#plt.plot(ticks_frame['time'], ticks_frame['ask'], 'r-', label='ask')
#plt.plot(ticks_frame['time'], ticks_frame['bid'], 'b-', label='bid')
 
# 凡例を表示する
#plt.legend(loc='upper left')
 
# ヘッダを追加する
#plt.title('GBPJPY ticks')
 
# チャートを表示する
#plt.show()

# 実行コマンド
# python test.py