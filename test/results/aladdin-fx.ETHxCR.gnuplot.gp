datafile = "aladdin-fx.ETHxCR.gnuplot.csv"
# additional imformation and error in aladdin-fx.ETHxCR.error.csv
set datafile separator comma
set key autotitle columnheader
set key bmargin
# set terminal pngcairo
# set output "aladdin-fx.ETHxCR.gnuplot.png
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
# set output "aladdin-fx.ETHxCR.gnuplot.svg
set xlabel "Ether Price (USD)"
set colorsequence default
set ylabel "Collateral ratio"
set ytics
set y2label "Leverage ratio"
set y2tics
set xrange reverse
plot datafile using ($4):($5) with lines  ,\
     datafile using ($4):($6) with lines  axes x1y2