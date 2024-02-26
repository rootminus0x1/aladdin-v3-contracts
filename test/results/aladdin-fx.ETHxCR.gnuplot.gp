set title "ETHxCR"
datafile = "aladdin-fx.ETHxCR.gnuplot.csv"
# additional imformation and error in aladdin-fx.ETHxCR.error.csv
set datafile separator comma
set key autotitle columnheader
set key bmargin
# set terminal pngcairo
# set output "aladdin-fx.ETHxCR.gnuplot.png
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
set colorsequence default
# set output "aladdin-fx.ETHxCR.gnuplot.svg
set xrange reverse
set xlabel "Ether Price (USD)"
set xtics
set xtics nomirror
set ylabel "Collateral ratio"
set ytics
set ytics nomirror
set y2label "Leverage ratio"
set y2tics
set y2tics nomirror
plot datafile using ($2):($5) with lines  ,\
     datafile using ($2):($6) with lines  axes x1y2