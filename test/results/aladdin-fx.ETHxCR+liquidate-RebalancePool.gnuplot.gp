set title "ETHxCR+liquidate-RebalancePool"
datafile = "aladdin-fx.ETHxCR+liquidate-RebalancePool.gnuplot.csv"
# additional imformation and error in aladdin-fx.ETHxCR+liquidate-RebalancePool.error.csv
set datafile separator comma
set key autotitle columnheader
set key bmargin
# set terminal pngcairo
# set output "aladdin-fx.ETHxCR+liquidate-RebalancePool.gnuplot.png
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
set colorsequence default
# set output "aladdin-fx.ETHxCR+liquidate-RebalancePool.gnuplot.svg
set xrange reverse
set xlabel "Collateral ratio"
set xtics
set xtics nomirror
set ylabel "Total supply of Fractional Tokens (1,000s)"
set ytics
set ytics nomirror
set y2label "Change in balance of stETH"
set y2tics
set y2tics nomirror
plot datafile using ($2):($4) with lines  ,\
     datafile using ($2):($5) with lines  axes x1y2,\
     datafile using ($2):($6) with lines  axes x1y2