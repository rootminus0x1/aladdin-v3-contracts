set title "ETHxCR" noenhanced
datafile = "aladdin-fx.ETHxCR.gnuplot.csv"
# additional imformation and error in aladdin-fx.ETHxCR.error.csv
set datafile separator comma
set key autotitle columnheader noenhanced
set key bmargin
set key title " "
# set terminal pngcairo
# set output "aladdin-fx.ETHxCR.gnuplot.png"
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
set colorsequence default
# set output "aladdin-fx.ETHxCR.gnuplot.svg"
set xrange reverse
set xlabel "Ether Price (USD)" noenhanced
set xtics
set xtics nomirror
set ylabel "Collateral ratio" noenhanced
set ytics
set ytics nomirror
set y2label "Leverage ratio" noenhanced
set y2tics
set y2tics nomirror
plot datafile using ($2):($5) with lines  ,\
     datafile using ($2):($6) with lines  axes x1y2
# stats datafile using 1 nooutput
# min = STATS_min
# max = STATS_max
# range_extension = 0.2 * (max - min)
# set xrange [min - range_extension : max + range_extension]
# stats datafile using 2 nooutput
# min = STATS_min
# max = STATS_max
# range_extension = 0.2 * (max - min)
# set yrange [min - range_extension : max + range_extension]
# stats datafile using 3 nooutput
# min = STATS_min
# max = STATS_max
# range_extension = 0.2 * (max - min)
# set y2range [min - range_extension : max + range_extension]