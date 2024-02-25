datafile = "aladdin-fx.ETHxCR+liquidate-RebalancePool.gnuplot.csv"
# additional imformation and error in aladdin-fx.ETHxCR+liquidate-RebalancePool.error.csv
set datafile separator comma
set key autotitle columnheader
set key bmargin
# set terminal pngcairo
# set output "aladdin-fx.ETHxCR+liquidate-RebalancePool.gnuplot.png
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
# set output "aladdin-fx.ETHxCR+liquidate-RebalancePool.gnuplot.svg
set xlabel "Ether Price (USD)"
set colorsequence default
set ylabel "Collateral ratio"
set ytics
set xrange reverse
plot datafile using ($3):($4) with lines  