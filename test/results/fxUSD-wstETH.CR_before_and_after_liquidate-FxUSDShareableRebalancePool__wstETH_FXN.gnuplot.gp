set title "CR_before_and_after_liquidate-FxUSDShareableRebalancePool__wstETH_FXN" noenhanced
datafile = "fxUSD-wstETH.CR_before_and_after_liquidate-FxUSDShareableRebalancePool__wstETH_FXN.gnuplot.csv"
# additional imformation and error in fxUSD-wstETH.CR_before_and_after_liquidate-FxUSDShareableRebalancePool__wstETH_FXN.error.csv
set datafile separator comma
set key autotitle columnheader noenhanced
set key bmargin
set key title " "
# set terminal pngcairo
# set output "fxUSD-wstETH.CR_before_and_after_liquidate-FxUSDShareableRebalancePool__wstETH_FXN.gnuplot.png"
set terminal svg enhanced size 800 566.5 background rgb "gray90"
set autoscale
set colorsequence default
# set output "fxUSD-wstETH.CR_before_and_after_liquidate-FxUSDShareableRebalancePool__wstETH_FXN.gnuplot.svg"
set xrange reverse
set xlabel "ETH v USD price" noenhanced
set xtics
set xtics nomirror
set ylabel "Collateral ratio" noenhanced
set ytics
set ytics nomirror
plot datafile using ($2):($3) with lines linetype 1,\
     datafile using ($2):($5) with lines linetype 2
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