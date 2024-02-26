set title "ETHxCR+liquidate-BoostableRebalancePool__wstETHWrapper"
datafile = "aladdin-fx.ETHxCR+liquidate-BoostableRebalancePool__wstETHWrapper.gnuplot.csv"
# additional imformation and error in aladdin-fx.ETHxCR+liquidate-BoostableRebalancePool__wstETHWrapper.error.csv
set datafile separator comma
set key autotitle columnheader
set key bmargin
# set terminal pngcairo
# set output "aladdin-fx.ETHxCR+liquidate-BoostableRebalancePool__wstETHWrapper.gnuplot.png
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
set colorsequence default
# set output "aladdin-fx.ETHxCR+liquidate-BoostableRebalancePool__wstETHWrapper.gnuplot.svg
set xrange reverse
set xlabel "Ether Price (USD)"
set xtics
set xtics nomirror
set ylabel "Collateral ratio"
set ytics
set ytics nomirror
set y2label "Total Supply (1,000,000s)"
set y2tics
set y2tics nomirror
plot datafile using ($2):($4) with lines  ,\
     datafile using ($2):($5) with lines  axes x1y2