package main

import (
	"fmt"
	"os"
	"strconv"
)

func main() {
	total := 0
	for i := 1; i < len(os.Args)-1; i++ {
		n, _ := strconv.Atoi(os.Args[i])
		total += n
	}
	fmt.Println(total)
}
