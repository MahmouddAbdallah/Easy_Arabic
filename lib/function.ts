export const sumMoney = (lesson: any) => {
    let sum: number = 0;
    lesson?.map((lesson: any) => {
        sum += lesson.money
    })
    return sum
}

export const sumDuration = (lesson: any) => {
    let sum: number = 0;
    lesson?.map((lesson: any) => {
        sum += lesson.duration
    })
    return sum
}

export const readableFormat = (timeStamp: string) => {
    return new Date(timeStamp)?.toISOString().replace('T', ' ')?.replace(/\.\d+Z$/, '');
}